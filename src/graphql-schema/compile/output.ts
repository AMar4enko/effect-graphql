import { runSync } from 'effect/Runtime'
import { AST, Schema } from '@effect/schema'
import { PropertySignature, TypeAnnotationId } from '@effect/schema/AST'
import { IntTypeId, isSchema } from '@effect/schema/Schema'
import { inspect } from 'bun'
import { Array as A, Effect, FiberRef, flow, Match, Option, pipe, Record as R, RequestResolver, Runtime } from 'effect'
import { Kind } from 'graphql'
import { GraphQLArgumentConfig, GraphQLBoolean, GraphQLFieldConfig, GraphQLFieldResolver, GraphQLFloat, GraphQLID, GraphQLInputFieldConfig, GraphQLInputObjectType, GraphQLInputType, GraphQLInt, GraphQLInterfaceType, GraphQLList, GraphQLNamedType, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLSchema, GraphQLString, GraphQLUnionType, ThunkObjMap } from 'graphql/type'
import { s } from 'vitest/dist/reporters-P7C2ytIv.js'

import { DeprecationReason, GqlInterface, RequestMetadata, RequestMetadataType, SurrogateAnnotationId } from '../annotation'
import { getInterfaces } from '../interface'
import { empty } from '../misc'
import { GqlSchema as GqlSchemaType, TaggedRequestNewable } from '../types'

import { compileInputFields } from './input'
import { compileEnum, compileScalar, GqlBuilderCacheRef, SchemaRef } from './misc'

const compileTuple = (ast: AST.TupleType) =>
  A.head(ast.elements).pipe(
    Effect.flatMap(el => compileOutputType(el.type)),
    Effect.map(inputType => new GraphQLList(inputType)),
    Effect.catchAll(() => Effect.fail(new Error(`Cannot compile input tuple type ${ast}`))),
  )

const compileTupleEnum = Match.type<AST.AST>().pipe(
  Match.tag(`TupleType`, ast => compileTuple(ast)),
  Match.tag(`Enums`, ast => compileEnum(ast)),
)

const compileOutputProperty = Match.type<AST.AST | Schema.PropertySignature.AST>().pipe(
  Match.tag(`PropertySignatureDeclaration`, (ast) => {
    const typeAst = ast.isOptional ? (ast.type as AST.Union).types[0] : ast.type
    const defaultValue = AST.getDefaultAnnotation(ast).pipe(Option.getOrUndefined)
    return compileOutputType(typeAst).pipe(
      Effect.map(type => ({
        type: ast.isOptional
          ? type
          : new GraphQLNonNull(type),
        defaultValue,
        description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
        deprecationReason: AST.getAnnotation(ast, DeprecationReason).pipe(
          Option.map(a => a as string),
          Option.getOrUndefined,
        ),
      })),
    )
  }),
  Match.tag(`PropertySignatureTransformation`, () => Effect.fail(new Error(`Cannot compile transformation property signature`))),
  Match.orElse((ast) => {
    const defaultValue = AST.getDefaultAnnotation(ast).pipe(Option.getOrUndefined)

    return compileOutputType(ast).pipe(
      Effect.map(type => ({
        type: new GraphQLNonNull(type),
        defaultValue,
        description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
        deprecationReason: AST.getAnnotation<string>(ast, DeprecationReason).pipe(Option.getOrUndefined),
      })),
    )
  }),
)

const makeResolver = (Request: TaggedRequestNewable<any>, resolver: RequestResolver.RequestResolver<any, never>) => Effect.gen(function* () {
  const runPromise = Runtime.runPromise(yield* Effect.runtime())
  const resolverWithContext = RequestResolver.contextFromEffect(resolver)
  const { ctxTag } = yield* FiberRef.get(SchemaRef)

  return (source: any, args: any, context: any, info: any) => {
    const eff = Effect.request(resolverWithContext)(new Request({
      parent: source,
      args,
    }))

    return runPromise(ctxTag ? Effect.provideService(ctxTag as any, context)(eff) : eff)
  }
})

const compileFields = (ast: AST.AST, props: PropertySignature[]) => Effect.gen(function* () {
  const [schema, builderCache, runtime] = yield* Effect.all([
    FiberRef.get(SchemaRef),
    FiberRef.get(GqlBuilderCacheRef),
    Effect.runtime<never>(),
  ])

  const requests = schema.type.get(ast)

  return yield* Effect.all(
    R.fromEntries(
      props.map(value => [
        value.name as string,
        Effect.gen(function* () {
          const fieldConfig: GraphQLFieldConfig<any, any, any> = {
            ...(yield* compileOutputProperty(value.type)),
          }

          if (requests && requests[value.name as string]) {
            const { tag, fields } = yield* AST.getAnnotation<RequestMetadataType>(ast, RequestMetadata).pipe(
              Effect.mapError(() => new Error(`GraphQL operation requests must be created using Operation class`)),
            )
            const res = yield* Effect.fromNullable(schema.resolver[tag]).pipe(
              Effect.catchAll(() => Effect.fail(new Error(`Could not find resolver for ${tag}`))),
              Effect.flatMap(r => RequestResolver.contextFromEffect(r as RequestResolver.RequestResolver<any, never>)),
            )

            const args = R.isEmptyRecord(fields) ? undefined : yield* compileInputFields(fields)

            fieldConfig.resolve = yield* makeResolver(requests[value.name as string], res)
            fieldConfig.args = args
          }

          return fieldConfig
        }),
      ] as const),
    ),
  )
})

/**
 * Type literals are supposed to be compiled into GraphQL interface
 */
const compileTypeLiteral = Match.type<AST.AST>().pipe(
  Match.tag(`TypeLiteral`, ast => Effect.gen(function* () {
    const runSync = Runtime.runSync(yield* Effect.runtime())
    const [schema, buildCache] = yield* Effect.all([FiberRef.get(SchemaRef), FiberRef.get(GqlBuilderCacheRef)])

    const name = yield* AST.getIdentifierAnnotation(ast).pipe(Effect.orElse(() => Effect.fail(new Error(`TypeLiteral must have identifier annotation`))))

    const fields = compileFields(ast, [...ast.propertySignatures])

    return new GraphQLInterfaceType({
      fields: () => runSync(fields),
      name,
      description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
    })
  })),
)

/**
 * Objects are Transforms to TypeLiteral with Surrogate annotation
 */
const compileTransformation = Match.type<AST.AST>().pipe(
  Match.tag(`Transformation`, ast => Effect.gen(function* () {
    const runSync = Runtime.runSync(yield* Effect.runtime())
    const [schema, buildCache, name] = yield* Effect.all([
      FiberRef.get(SchemaRef),
      FiberRef.get(GqlBuilderCacheRef),
      AST.getIdentifierAnnotation(ast.to).pipe(
        Effect.orElse(() => Effect.fail(new Error(`Transformation ${ast} must have identifier annotation`))),
      ),
    ])

    const surrogate = yield* AST.getAnnotation<AST.TypeLiteral>(ast, SurrogateAnnotationId).pipe(
      Effect.orElse(() => Effect.fail(new Error(`Only TaggedClass Transforms are supported`))),
    )

    const interfaces = Effect.all([

    ])

    AST.getAnnotation(ast, GqlInterface).pipe(
      Option.getOrElse(() => []),
    )

    const fields = compileFields(ast, [...surrogate.propertySignatures])

    return new GraphQLObjectType({
      fields: () => runSync(fields),
      name,
      description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),

    })
  })),
)

const compileOutputType = (ast: AST.AST): Effect.Effect<GraphQLOutputType, Error> => Effect.gen(function* () {
  const builderCache = yield* FiberRef.get(GqlBuilderCacheRef)

  const compiler = compileScalar.pipe(
    Match.orElse(
      compileTupleEnum.pipe(
        Match.orElse(
          compileTypeLiteral.pipe(
            Match.orElse(ast => Effect.fail(new Error(`Could not compile input type for ${ast}`))),
          ),
        ),
      ),
    ),
  )

  return yield* Effect.orElse(
    Effect.fromNullable(
      builderCache.input.get(ast),
    ),
    () => compiler(ast),
  )
})
