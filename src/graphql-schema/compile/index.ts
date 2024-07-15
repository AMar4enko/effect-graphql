import { AST } from '@effect/schema'
import { Effect, pipe, Record as R, Runtime } from 'effect'
import { GraphQLBoolean, GraphQLFieldConfig, GraphQLObjectType, GraphQLOutputType, GraphQLSchema, ThunkObjMap } from 'graphql'

import { getOperationMetadata } from '../annotation'
import { GqlSchema, TaggedRequestNewable } from '../types'
import { compileInputFields } from './input'
import { compileOutputType } from './output'
import { getResolverArgs, makeResolver } from './misc'

export const compile = Effect.gen(function* () {
    const mutation: ThunkObjMap<GraphQLFieldConfig<any, any, any>> = {}
    const query: ThunkObjMap<GraphQLFieldConfig<any, any, any>> = {}

    const schema = yield* GqlSchema

  
    yield* pipe(
      R.toEntries(schema.query),
      Effect.forEach(([name, taggedRequest]) => Effect.gen(function* () {
        const args = yield* getResolverArgs(taggedRequest)
        const { Success } = yield* getOperationMetadata(taggedRequest)
        const resultType = yield* compileOutputType(Success.ast)

        const requestResolver = schema.resolver.get(taggedRequest)

        query[name] = {
          args,
          type: resultType,
          resolve: requestResolver ? yield* makeResolver(taggedRequest, requestResolver as any) : undefined,
          deprecationReason: undefined,
        }
      }))
    )

    yield* pipe(
      R.toEntries(schema.mutation),
      Effect.forEach(([name, taggedRequest]) => Effect.gen(function* () {
        const args = yield* getResolverArgs(taggedRequest)
        const { Success } = yield* getOperationMetadata(taggedRequest)
        const resultType = yield* compileOutputType(Success.ast)

        const requestResolver = schema.resolver.get(taggedRequest)

        query[name] = {
          args,
          type: resultType,
          resolve: requestResolver ? yield* makeResolver(taggedRequest, requestResolver as any) : undefined,
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
