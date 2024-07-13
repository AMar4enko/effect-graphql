import { TaggedError } from 'effect/Data'
import { runSync } from 'effect/Runtime'
import { AST, Schema } from '@effect/schema'
import { TypeAnnotationId } from '@effect/schema/AST'
import { IntTypeId, isSchema } from '@effect/schema/Schema'
import { inspect } from 'bun'
import { Array as A, Effect, FiberRef, flow, Match, Option, pipe, Record as R, RequestResolver, Runtime } from 'effect'
import { Kind } from 'graphql'
import { GraphQLArgumentConfig, GraphQLBoolean, GraphQLEnumType, GraphQLEnumTypeConfig, GraphQLEnumValueConfig, GraphQLFieldConfig, GraphQLFloat, GraphQLID, GraphQLInputObjectType, GraphQLInputType, GraphQLInt, GraphQLInterfaceType, GraphQLList, GraphQLNamedType, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLSchema, GraphQLString, ThunkObjMap } from 'graphql/type'
import { s } from 'vitest/dist/reporters-P7C2ytIv.js'

import { DeprecationReason } from '../annotation'
import { getInterfaces } from '../interface'
import { empty } from '../misc'
import { GqlSchema as GqlSchemaType, TaggedRequestNewable } from '../types'

export const declarationToScalar = (ast: AST.Declaration, startIndex = 1) => Effect.gen(function* () {
  const parse = ast.decodeUnknown(...ast.typeParameters)
  const serialize = ast.encodeUnknown(...ast.typeParameters)

  const cache = yield* FiberRef.get(GqlBuilderCacheRef)

  const s = cache.scalar.get(ast) || new GraphQLScalarType({
    name: Option.getOrElse(() => `Scalar${startIndex}`)(AST.getIdentifierAnnotation(ast)),
    description: Option.getOrUndefined(AST.getDescriptionAnnotation(ast)),
    parseValue: input => parse(input, { errors: `first`, onExcessProperty: `ignore` }, ast),
    serialize: output => serialize(output, { errors: `first`, onExcessProperty: `ignore` }, ast),
    parseLiteral: (a, b) => {
      if (a.kind === Kind.VARIABLE) {
        const vars = b ?? {}
        return parse(vars[a.name.value], { errors: `first`, onExcessProperty: `ignore` }, ast)
      }
      if (a.kind === Kind.INT || a.kind === Kind.FLOAT || a.kind === Kind.STRING || a.kind === Kind.BOOLEAN) {
        return parse(a.value, { errors: `first`, onExcessProperty: `ignore` }, ast)
      }

      throw new Error(`Unsupported literal kind: ${a.kind}`)
    },
  })

  cache.scalar.set(ast, s)

  return s
})

export const compileEnum = (ast: AST.Enums) => Effect.gen(function* () {
  const cache = yield* FiberRef.get(GqlBuilderCacheRef)

  const enumType = cache.enum.get(ast) || new GraphQLEnumType({
    name: AST.getIdentifierAnnotation(ast).pipe(Option.getOrElse(() => `Enum${cache.scalar.size}`)),
    description: Option.getOrUndefined(AST.getDescriptionAnnotation(ast)),
    values: R.fromEntries(
      ast.enums.map(([key, value]): [string, GraphQLEnumValueConfig] => [
        key,
        {
          value,
        },
      ]),
    ),
  })

  cache.enum.set(ast, enumType)

  return enumType
})

export const compileScalar = Match.type<AST.AST>().pipe(
  Match.tag(`BooleanKeyword`, () => Effect.succeed(GraphQLBoolean)),
  Match.tag(`NumberKeyword`, (ast) => {
    const scalar = pipe(
      AST.getAnnotation(ast, TypeAnnotationId),
      Option.flatMap(type => type === IntTypeId ? Option.some(GraphQLInt) : Option.none()),
      Option.getOrElse(() => GraphQLFloat),
    )

    return Effect.succeed(scalar)
  }),
  Match.tag(`StringKeyword`, (ast) => {
    const scalar = pipe(
      AST.getBrandAnnotation(ast),
      Option.flatMap(brand => Option.fromNullable(brand[0] == `GqlID` ? GraphQLID : undefined)),
      Option.getOrElse(() => GraphQLString),
    )

    return Effect.succeed(scalar)
  }),
  Match.tag(`Declaration`, (ast) => {
    return declarationToScalar(ast)
  }),
)

export const makeBuilderCache = () => ({
  enum: new Map() as Map<AST.AST, GraphQLEnumType>,
  scalar: new Map() as Map<AST.AST, GraphQLScalarType>,
  interface: new Map() as Map<AST.AST, GraphQLInterfaceType>,
  object: new Map() as Map<AST.AST, GraphQLObjectType>,
  input: new Map() as Map<AST.AST, GraphQLInputObjectType>,
  mutation: {} as ThunkObjMap<GraphQLFieldConfig<any, any, any>>,
  subscription: {} as ThunkObjMap<GraphQLFieldConfig<any, any, any>>,
  query: {} as ThunkObjMap<GraphQLFieldConfig<any, any, any>>,
})

export const GqlBuilderCacheRef = FiberRef.unsafeMake(makeBuilderCache())
export const SchemaRef = FiberRef.unsafeMake<GqlSchemaType<
  Map<any, { [key in string]: TaggedRequestNewable<any> }>,
  Record<string, TaggedRequestNewable<any>>,
  Record<string, TaggedRequestNewable<any>>,
  Record<string, TaggedRequestNewable<any>>,
  Record<string, RequestResolver.RequestResolver<any, any>>
>>(empty())

const compileInputFields = (a: AST.AST, props: AST.PropertySignature[]) => Effect.gen(function *() {
  yield* Effect.logDebug(`Generating field defs for ${a}`)

  const schemaDef = yield* FiberRef.get(SchemaRef)

  return pipe(
    props,
    A.map((prop) => {
      const request = Option.fromNullable(schemaDef.type.get(a))
        .pipe(
          Option.flatMap(o => typeof prop.name === `string` ? Option.fromNullable(o[prop.name]) : Option.none()),
        )

      return [
        prop.name as string,
        {
          args: request.pipe(Option.map(getResolverArgs)).pipe(Option.getOrUndefined),
          type: getType(prop.type),
          description: Option.getOrUndefined(AST.getDescriptionAnnotation(prop)),
          resolve: () => 1,
          deprecationReason: Option.getOrUndefined(AST.getAnnotation(prop, DeprecationReason)),
        } satisfies GraphQLFieldConfig<any, any, any>,
      ] as const
    }),
    R.fromEntries,
  )
})

const compileOutputFields = (a: AST.AST, props: AST.PropertySignature[]) => Effect.gen(function *() {
  yield* Effect.logDebug(`Generating field defs for ${a}`)

  return pipe(
    props,
    A.map((prop) => {
      const request = Option.fromNullable(s.type.get(a))
        .pipe(
          Option.flatMap(o => typeof prop.name === `string` ? Option.fromNullable(o[prop.name]) : Option.none()),
        )

      return [
        prop.name as string,
        {
          args: request.pipe(Option.map(getResolverArgs)).pipe(Option.getOrUndefined),
          type: getType(prop.type),
          description: Option.getOrUndefined(AST.getDescriptionAnnotation(prop)),
          resolve: () => 1,
          deprecationReason: Option.getOrUndefined(AST.getAnnotation(prop, DeprecationReason)),
        } satisfies GraphQLFieldConfig<any, any, any>,
      ] as const
    }),
    R.fromEntries,
  )
})

// const compileOutputFields

// (scalars: Map<AST.AST, GraphQLScalarType>) =>

//   (d: AST.Declaration) =>
//     scalars.get(d) || (() => {
//       const parse = d.decodeUnknown(...d.typeParameters)
//       const serialize = d.encodeUnknown(...d.typeParameters)
//       const scalar = new GraphQLScalarType({
//         name: Option.getOrElse(() => `Scalar${scalars.size}`)(AST.getIdentifierAnnotation(d)),
//         description: Option.getOrUndefined(AST.getDescriptionAnnotation(d)),
//         parseValue: input => parse(input, { errors: `first`, onExcessProperty: `ignore` }, d),
//         serialize: output => serialize(output, { errors: `first`, onExcessProperty: `ignore` }, d),
//         parseLiteral: (a, b) => {
//           if (a.kind === Kind.VARIABLE) {
//             const vars = b ?? {}
//             return parse(vars[a.name.value], { errors: `first`, onExcessProperty: `ignore` }, d)
//           }
//           if (a.kind === Kind.INT || a.kind === Kind.FLOAT || a.kind === Kind.STRING || a.kind === Kind.BOOLEAN) {
//             return parse(a.value, { errors: `first`, onExcessProperty: `ignore` }, d)
//           }

//           throw new Error(`Unsupported literal kind: ${a.kind}`)
//         },
//       })
//       scalars.set(d, scalar)

//       return scalar
//     })()
