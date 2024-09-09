import { AST } from '@effect/schema'
import { TypeAnnotationId } from '@effect/schema/AST'
import { IntTypeId, TaggedRequestClass } from '@effect/schema/Schema'
import { Effect, FiberRef, Match, Option, pipe, Record as R, RequestResolver, Runtime } from 'effect'
import { Kind } from 'graphql'
import { GraphQLBoolean, GraphQLEnumType, GraphQLEnumValueConfig, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLScalarType, GraphQLString } from 'graphql'

import { Reference, SurrogateAnnotationId } from '../annotation'
import { GqlSchemaCache } from '../types.js'
import { compileInputFields } from './input'
import { TaggedRequestNewable } from '../schema.js'
import * as Ctx from './context.js'

const schemaCacheRef = FiberRef.unsafeMake<GqlSchemaCache>({
  ast: new WeakMap(),
  id: new Map(),
  idx: 0
})

export const getSchemaCache = FiberRef.get(schemaCacheRef)

export const cache = (ast: AST.AST) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  FiberRef.get(schemaCacheRef).pipe(
    Effect.bindTo(`cache`),
    Effect.bind(`id`, () => {
      const idCarrier = ast._tag === `Transformation`
        ? ast.to
        : ast;
        
      return AST.getIdentifierAnnotation(idCarrier).pipe(Effect.orElseSucceed(() => undefined))
    }),
    Effect.bind(`reference`, () => {
      return AST.getAnnotation<string>(ast, Reference).pipe(Effect.orElseSucceed(() => undefined))
    }),
    Effect.flatMap(({ cache, id, reference }) => {
      const key = id ?? reference

      if (key) {
        return Effect.fromNullable(cache.id.get(key)).pipe(
          Effect.orElse(() => effect),
          Effect.tap((type) => (cache.id.set(key, type), cache.idx += 1))
        )
      } else {
        return Effect.fromNullable(cache.ast.get(ast)).pipe(
          Effect.orElse(() => effect),
          Effect.tap((type) => (cache.ast.set(ast, type), cache.idx += 1))
        )
      }

      
    }),
  )

export const declarationToScalar = (ast: AST.Declaration) => Effect.gen(function* () {
  const parse = ast.decodeUnknown(...ast.typeParameters)
  const serialize = ast.encodeUnknown(...ast.typeParameters)

  const cache = yield* getSchemaCache

  return new GraphQLScalarType({
    name: Option.getOrElse(() => `Scalar${cache.idx}`)(AST.getIdentifierAnnotation(ast)),
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
})

export const compileEnum = (ast: AST.Enums) => Effect.gen(function* () {
  const cache = yield* getSchemaCache
  return new GraphQLEnumType({
    name: AST.getIdentifierAnnotation(ast).pipe(Option.getOrElse(() => `Enum${cache.idx}`)),
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
})

export const compileScalar = Match.type<AST.AST>().pipe(
  Match.tag(`BooleanKeyword`, (ast) => Effect.succeed(GraphQLBoolean).pipe(cache(ast))),
  Match.tag(`NumberKeyword`, (ast) => {
    const scalar = pipe(
      AST.getAnnotation(ast, TypeAnnotationId),
      Option.flatMap(type => type === IntTypeId ? Option.some(GraphQLInt) : Option.none()),
      Option.getOrElse(() => GraphQLFloat),
    )

    return Effect.succeed(scalar).pipe(cache(ast))
  }),
  Match.tag(`StringKeyword`, (ast) => {
    const scalar = pipe(
      AST.getBrandAnnotation(ast),
      Option.flatMap(brand => Option.fromNullable(brand[0] == `GqlID` ? GraphQLID : undefined)),
      Option.getOrElse(() => GraphQLString),
    )

    return Effect.succeed(scalar).pipe(cache(ast))
  }),
  Match.tag(`Declaration`, (ast) => {
    return declarationToScalar(ast).pipe(cache(ast))
  }),
  Match.when((ast) => {
    return ast._tag === `Transformation` 
      && ast.transformation._tag === `FinalTransformation`
      && !AST.getAnnotation(ast.to, SurrogateAnnotationId).pipe(
        Option.getOrUndefined
      )
  }, ast => {
    if (ast._tag !== `Transformation`) {
      return Effect.failSync(() => new Error(`Transformation not supported ${ast}`))
    }

    if (ast.transformation._tag === `FinalTransformation`) {
      const parse = ast.transformation.decode
      const serialize = ast.transformation.encode

      const compile = Effect.gen(function* () {
        console.log(ast)
        return new GraphQLScalarType({
          name: AST.getIdentifierAnnotation(ast).pipe(
            Option.getOrThrowWith(() => new Error(`Identifier missing ${ast}`)),
          ),
          description: Option.getOrUndefined(AST.getDescriptionAnnotation(ast)),
          parseValue: input => parse(input, { errors: `first`, onExcessProperty: `ignore` }, ast, input),
          serialize: output => serialize(output, { errors: `first`, onExcessProperty: `ignore` }, ast, output),
          parseLiteral: (a, b) => {
            if (a.kind === Kind.VARIABLE) {
              const vars = b ?? {}
              return parse(vars[a.name.value], { errors: `first`, onExcessProperty: `ignore` }, ast, vars[a.name.value])
            }
            if (a.kind === Kind.INT || a.kind === Kind.FLOAT || a.kind === Kind.STRING || a.kind === Kind.BOOLEAN) {
              return parse(a.value, { errors: `first`, onExcessProperty: `ignore` }, ast, a.value)
            }
  
            throw new Error(`Unsupported literal kind: ${a.kind}`)
          },
        })
      })

      return compile.pipe(cache(ast))
    }


    return Effect.failSync(() => new Error(`Transformation not supported ${ast}`))
  })
)

export const omitTag = (declarations: AST.PropertySignature[]) => declarations.filter((a) => a.name !== `_tag`)

export const makeResolver = (Request: TaggedRequestNewable<any>, resolver: RequestResolver.RequestResolver<any, never>) => Effect.gen(function* () {
  const runPromise = Runtime.runPromise(yield* Effect.runtime())
  const resolverWithContext = RequestResolver.contextFromEffect(resolver)
  return (source: any, args: any, context: any, info: any) => {
    /**
     * Operations get resolved without source
     */
    const req = source === undefined
      ? new Request(args)
      : new Request({
        parent: source,
        args,
      })

    const eff = Effect.request(resolverWithContext)(req)

    return runPromise(eff)
  }
})

export const getResolverArgs = (a: TaggedRequestClass<any, any, any, any, any>) => 
  Effect.logDebug(`Generating resolver args for ${a}`).pipe(
    Effect.zipRight(
      compileInputFields(a.fields)
    ),
    Effect.tap(Effect.logDebug)
  )