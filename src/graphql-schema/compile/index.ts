import { AST, Schema } from '@effect/schema'
import { TypeAnnotationId } from '@effect/schema/AST'
import { IntTypeId, isSchema } from '@effect/schema/Schema'
import { inspect } from 'bun'
import { Array as A, Effect, flow, Match, Option, pipe, Record as R, RequestResolver, Runtime } from 'effect'
import { Kind } from 'graphql'
import { GraphQLArgumentConfig, GraphQLBoolean, GraphQLFieldConfig, GraphQLFloat, GraphQLID, GraphQLInputObjectType, GraphQLInputType, GraphQLInt, GraphQLInterfaceType, GraphQLList, GraphQLNamedType, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLSchema, GraphQLString, ThunkObjMap } from 'graphql/type'

import { DeprecationReason } from '../annotation'
import { getInterfaces } from '../interface'
import { GqlSchema, GqlSchemaRegistrar, TaggedRequestNewable } from '../types'
import { compileInputFields, compileInputType } from './input'

const matchPropertyAst = <Type extends GraphQLInputType | GraphQLOutputType>(getType: (ast: AST.AST) => Option.Option<Type>) => Match.type<AST.AST | Schema.PropertySignature.AST>().pipe(
  Match.tag(`PropertySignatureDeclaration`, (ast) => {
    const typeAst = ast.isOptional ? (ast.type as AST.Union).types[0] : ast.type
    const defaultValue = AST.getDefaultAnnotation(ast).pipe(Option.getOrUndefined)
    return getType(typeAst).pipe(
      Option.map(type =>
        ({
          type: ast.isOptional
            ? type
            : new GraphQLNonNull(type),
          defaultValue,
          description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
          deprecationReason: AST.getAnnotation(ast, DeprecationReason).pipe(
            Option.map(a => a as string),
            Option.getOrUndefined,
          ),
        }),
      ),
    )
  }),
  Match.tag(`PropertySignatureTransformation`, () => Option.none()),
  Match.orElse((ast) => {
    const defaultValue = AST.getDefaultAnnotation(ast).pipe(Option.getOrUndefined)

    return getType(ast).pipe(
      Option.map(type =>
        ({
          type: new GraphQLNonNull(type),
          defaultValue,
          description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
          deprecationReason: AST.getAnnotation(ast, DeprecationReason).pipe(
            Option.map(a => a as string),
            Option.getOrUndefined,
          ),
        }),
      ),
    )
  }),
)

export const toScalar = (d: AST.Declaration) => Effect.gen(function* () {
  const { scalars } = yield* GqlSchemaRegistrar

  scalars.get(d) || (() => {
    const parse = d.decodeUnknown(...d.typeParameters)
    const serialize = d.encodeUnknown(...d.typeParameters)
    const scalar = new GraphQLScalarType({
      name: Option.getOrElse(() => `Scalar${scalars.size}`)(AST.getIdentifierAnnotation(d)),
      description: Option.getOrUndefined(AST.getDescriptionAnnotation(d)),
      parseValue: input => parse(input, { errors: `first`, onExcessProperty: `ignore` }, d),
      serialize: output => serialize(output, { errors: `first`, onExcessProperty: `ignore` }, d),
      parseLiteral: (a, b) => {
        if (a.kind === Kind.VARIABLE) {
          const vars = b ?? {}
          return parse(vars[a.name.value], { errors: `first`, onExcessProperty: `ignore` }, d)
        }
        if (a.kind === Kind.INT || a.kind === Kind.FLOAT || a.kind === Kind.STRING || a.kind === Kind.BOOLEAN) {
          return parse(a.value, { errors: `first`, onExcessProperty: `ignore` }, d)
        }

        throw new Error(`Unsupported literal kind: ${a.kind}`)
      },
    })
    scalars.set(d, scalar)

    return scalar
  })()
})

export const compile = <
  Type extends Map<any, { [key in string]: TaggedRequestNewable<any> }>,
  Query extends Record<string, TaggedRequestNewable<any>>,
  Mutation extends Record<string, TaggedRequestNewable<any>>,
  Subscription extends Record<string, TaggedRequestNewable<any>>,
  Resolver extends Record<string, RequestResolver.RequestResolver<any, any>>,
>(s: GqlSchema<Type, Query, Mutation, Subscription, Resolver>) => Effect.gen(function* () {
    const mutation: ThunkObjMap<GraphQLFieldConfig<any, any, any>> = {}
    const query: ThunkObjMap<GraphQLFieldConfig<any, any, any>> = {}

    const runtime = yield* Effect.runtime()
    const runPromise = Runtime.runPromise(runtime)

    const runSync = Runtime.runSync(runtime)

    const getType = (ast: AST.AST): GraphQLOutputType => {
      return GraphQLBoolean
    }

    const getResolverArgs = (a: TaggedRequestNewable<any>) => 
      Effect.logDebug(`Generating resolver args for ${a}`).pipe(
        Effect.zipRight(
          compileInputFields(a.fields)
        ),
        Effect.tap(Effect.logDebug)
      )
  

    // const generateFields = (a: AST.AST, props: AST.PropertySignature[]) => Effect.gen(function *() {
    //   yield* Effect.logDebug(`Generating field defs for ${a}`)
    //   return pipe(
    //     props,
    //     A.map((prop) => {
    //       const request = Option.fromNullable(s.type.get(a))
    //         .pipe(
    //           Option.flatMap(o => typeof prop.name === `string` ? Option.fromNullable(o[prop.name]) : Option.none()),
    //         )

    //       return [
    //         prop.name as string,
    //         {
    //           args: request.pipe(Option.map(getResolverArgs)).pipe(Option.getOrUndefined),
    //           type: getType(prop.type),
    //           description: Option.getOrUndefined(AST.getDescriptionAnnotation(prop)),
    //           resolve: () => 1,
    //           deprecationReason: Option.getOrUndefined(AST.getAnnotation(prop, DeprecationReason)),
    //         } satisfies GraphQLFieldConfig<any, any, any>,
    //       ] as const
    //     }),
    //     R.fromEntries,
    //   )
    // }).pipe(
    //   Effect.tap(Effect.logDebug),
    //   runSync,
    // )

    const compileTypeLiteral = (a: AST.TypeLiteral) => Effect.gen(function* () {
      yield* Effect.logDebug(`Compiling type literal ${a}`)
      // const fields = generateFields(a, [...a.propertySignatures])

      // if (AST.isTypeLiteral(a)) {
      //   return interfaces.get(a) || (() => {
      //     const fields = generateFields(a, [...a.propertySignatures])

      //     const name = Option.getOrThrowWith(AST.getIdentifierAnnotation(a), () => new Error(`Object must have an identifier`))
      //     const description = Option.getOrUndefined(AST.getDescriptionAnnotation(a))

      //     const i = new GraphQLInterfaceType({
      //       fields,
      //       name,
      //       description,
      //       interfaces: () => getInterfaces(a).map(compileTypeLiteral).filter(Boolean),
      //     })

      //     interfaces.set(a, i)

      //     return Option.some(i)
      //   })()
      // }

      // return Option.none()
    }).pipe(
      runSync,
    )

    const matchScalar = Match.type<AST.AST>().pipe(
      Match.tag(`BooleanKeyword`, () => GraphQLBoolean),
      Match.tag(`NumberKeyword`, (ast) => {
        const scalar = pipe(
          AST.getAnnotation(ast, TypeAnnotationId),
          Option.flatMap(type => type === IntTypeId ? Option.some(GraphQLInt) : Option.none()),
          Option.getOrElse(() => GraphQLFloat),
        )

        return scalar
      }),
      Match.tag(`StringKeyword`, (ast) => {
        const scalar = pipe(
          AST.getBrandAnnotation(ast),
          Option.flatMap(brand => Option.fromNullable(brand[0] == `GqlID` ? GraphQLID : undefined)),
          Option.getOrElse(() => GraphQLString),
        )

        return scalar
      }),
      Match.tag(`Declaration`, (ast) => {
        const scalar = toScalar(ast)
        return scalar
      }),
      Match.option,
    )

    // const matchType = (a: AST.AST): any => pipe(
    //   matchScalar(a),
    //   Option.fromNullable,
    //   Option.getOrElse(() => {

    //   }),
    // )

    yield* pipe(
      R.toEntries(s.query),
      Effect.forEach(([name, taggedRequest]) => Effect.gen(function* () {
        const args = yield* getResolverArgs(taggedRequest)

        query[name] = {
          args,
          type: new GraphQLList(GraphQLID),
          resolve: () => [`1`],
          deprecationReason: undefined,
        }
      }))
    )

    const { objects, interfaces, inputs } = yield* GqlSchemaRegistrar
    
    return new GraphQLSchema({
      types: [
        ...objects.values(),
        ...interfaces.values(),
        ...inputs.values(),
      ],
      // subscription: new GraphQLObjectType({
      //   fields: {
      //     a: {
      //       s,
      //     },
      //   },
      // }),
      query: new GraphQLObjectType({
        name: `Query`,
        fields: query,
      }),
    })
  })
