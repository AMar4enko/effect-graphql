import { createYoga } from 'graphql-yoga'
import { GraphQLSchema} from 'graphql'
import { createServer } from 'node:http'
import { Context, Effect, Layer, Logger, LogLevel, pipe, RequestResolver } from 'effect'
import { HttpApp, HttpServer, HttpServerRequest, HttpServerResponse } from '@effect/platform'
import { Schema as S } from '@effect/schema'
import { Operation } from './operation'
import * as Gql from './schema'
import { compile } from './compile'
import { serve } from 'bun'
import { NodeContext, NodeHttpPlatform, NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import * as Ctx from './compile/context'

interface GqlServerContract {
  runSchema: (schema: GraphQLSchema) => Effect.Effect<HttpServerResponse.HttpServerResponse, any, HttpServerRequest.HttpServerRequest>
}

const make = Effect.gen(function* () {
  return {
    runSchema: (schema: GraphQLSchema) => {
      const yogaServer = createYoga({ schema })

      return HttpServerRequest.HttpServerRequest.pipe(
        Effect.andThen(req => {
          const res = yogaServer(req.source as any, (req as any).response)
          const eff = `then` in res ? Effect.tryPromise(() => res) : Effect.succeed(res)
  
          return Effect.map(eff, (resolvedResponse) => ({ resolvedResponse }) as unknown as HttpServerResponse.HttpServerResponse)
        }),
      )
    }
  }
})

class GqlServer extends Context.Tag(`effect-graphql/server`)<
  GqlServer,
  GqlServerContract
>() {
  static yoga = Layer.effect(GqlServer, make)
}

class User extends S.TaggedClass<User>()(
  `User`,
  {
    name: S.String,
    random: S.Number,
  },
) {}

const Pagination = S.partial(S.Struct({
  cursor: S.String
})).pipe(
  S.annotations({ identifier: `Pagination` })
)

class GetCurrentUser extends Operation<GetCurrentUser>()(
  `getCurrentUser`,
  {
    failure: S.Number,
    success: S.Union(User, S.Undefined),
    payload: {
      pagination: Pagination
    },
  }
) {}

class GetRandom extends Operation<GetRandom>()(
  `getRandom`,
  {
    failure: S.Number,
    success: S.Number,
    payload: {
      parent: User
    }
  }
) {}

const resolver = RequestResolver.fromEffectTagged<GetCurrentUser | GetRandom>()({
  getCurrentUser: (req) => Effect.succeed([
    {
      _tag: `User`,
      name: `Alex`
    }
  ]),
  getRandom: (req) => Effect.succeed([
    Math.random()
  ])
})

const source = pipe(
  Gql.make(),
  Gql.withQueries({
    currentUser: GetCurrentUser,
  }),
  Gql.resolveField(User, {
    random: GetRandom
  }),
  Gql.withResolver(resolver)
)

const runTheThing = Effect.gen(function* () {
  const [schema, server] = yield* Effect.all([compile, GqlServer])

  return HttpServer.serve()(
    server.runSchema(schema)
  )
})

Effect.never.pipe(
  Effect.provide(Layer.unwrapEffect(runTheThing)),
  Effect.provideService(Ctx.Schema, source),
  Effect.provide(GqlServer.yoga),
  Effect.provide(NodeHttpServer.layer(() => createServer(), { port: 8080 } )),
  Effect.provide(Logger.minimumLogLevel(LogLevel.All)),
  NodeRuntime.runMain
)


