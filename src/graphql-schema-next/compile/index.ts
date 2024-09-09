import { AST } from '@effect/schema'
import { Context, Effect, pipe, Record as R, Runtime } from 'effect'
import { GraphQLBoolean, GraphQLFieldConfig, GraphQLObjectType, GraphQLOutputType, GraphQLSchema, ThunkObjMap } from 'graphql'

// import { getOperationMetadata } from '../annotation'
import { Schema, TaggedRequestNewable } from '../schema.js'
import { compileInputFields } from './input.js'
import { compileOutputType } from './output.js'
import { getResolverArgs, makeResolver } from './misc.js'
import { TaggedRequestClass } from '@effect/schema/Schema'
import * as Ctx from './context.js'

export const compile = Effect.gen(function* () {
    const schema = yield* Ctx.Schema

    const query: ThunkObjMap<GraphQLFieldConfig<any, any, any>> = {}
    const mutation: ThunkObjMap<GraphQLFieldConfig<any, any, any>> = {}

    console.log(schema.definition.resolver)

    yield* pipe(
      R.toEntries(schema.definition.query || {}),
      Effect.forEach(([name, taggedRequest]) => Effect.gen(function* () {
        const r: TaggedRequestClass<any, any, any, any, any> = taggedRequest as any

        const args = yield* getResolverArgs(r)
        const resultType = yield* compileOutputType(r.success.ast)

        query[name] = {
          args,
          type: resultType,
          resolve: yield* makeResolver(r, schema.definition.resolver),
          deprecationReason: undefined,
        }
      }))
    )

    yield* pipe(
      R.toEntries(schema.definition.mutation || {}),
      Effect.forEach(([name, taggedRequest]) => Effect.gen(function* () {
        const r: TaggedRequestClass<any, any, any, any, any> = taggedRequest as any

        const args = yield* getResolverArgs(r)
        const resultType = yield* compileOutputType(r.success.ast)

        mutation[name] = {
          args,
          type: resultType,
          resolve: yield* makeResolver(r, schema.definition.resolver),
          deprecationReason: undefined,
        }
      }))
    )

    return new GraphQLSchema({
      types: [
        // ...objects.values(),
        // ...interfaces.values(),
        // ...inputs.values(),
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