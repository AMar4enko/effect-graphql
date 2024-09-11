import { createYoga, Plugin, useExecutionCancellation } from 'graphql-yoga'
import { GraphQLSchema} from 'graphql'
import { createServer } from 'node:http'
import { Console, Context, Effect, Fiber, Layer, Logger, LogLevel, pipe, RequestResolver, Runtime } from 'effect'
import { HttpServer, HttpServerRequest, HttpServerResponse } from '@effect/platform'
import { Schema as S } from '@effect/schema'
import { Operation } from './operation'
import * as Gql from './schema'
import { compile } from './compile'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import * as Ctx from './compile/context'
import { GqlInterface, GqlType } from './entity'

interface GqlServerContract {
  runSchema: (schema: GraphQLSchema) => Effect.Effect<never, never, HttpServer.HttpServer>
}

const runWithYoga = (plugins: Plugin[]) => (schema: GraphQLSchema) => Effect.gen(function*( ) {
  const runSync = Runtime.runSync(yield* Effect.runtime())

  const yogaServer = createYoga({
    plugins: [useExecutionCancellation()],
    schema,
    context: () => {
      return runSync(Effect.withFiberRuntime((fiber, running): Effect.Effect<any, never, never> => {
        return Effect.disconnect(
          Effect.runtime().pipe(
            Effect.withSpan(`Context`)
          )
        ).pipe(Effect.map((runtime) => ({ runPromise: Runtime.runPromise(runtime) })))
      }))
    }
  })
  
  return HttpServerRequest.HttpServerRequest.pipe(
      Effect.andThen(req => {
        const res = yogaServer(req.source as any, (req as any).response)
        const eff = `then` in res ? Effect.tryPromise(() => res) : Effect.succeed(res)

        return Effect.map(eff, (resolvedResponse) => ({ resolvedResponse }) as unknown as HttpServerResponse.HttpServerResponse)
      }),
    )
})

class Commentable extends GqlInterface<Commentable>()(
  `Commentable`,
  {
    comments: S.optional(S.Array(S.String))
  },
) {}

class User extends GqlType<User>()(
  `User`,
  {
    name: S.String,
    random: S.Number,
  },
  [Commentable]
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
    payload: {},
  }
) {}

class GetUsers extends Operation<GetUsers>()(
  `getUsers`,
  {
    failure: S.Number,
    success: S.Array(User),
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


const resolver = RequestResolver.fromEffectTagged<GetCurrentUser | GetRandom | GetUsers>()({
  getUsers: (req) => Effect.succeed([
    [new User.partial({ name: `Test user` }, { disableValidation: true })],
  ]),
  getCurrentUser: (req) => Effect.succeed([
    new User.partial({ name: `123` }, { disableValidation: true })
  ]),
  getRandom: (req) => Effect.succeed([
    Math.random()
  ])
})

const source = pipe(
  Gql.make(),
  Gql.withQueries({
    getUsers: GetUsers,
    currentUser: GetCurrentUser,
  }),
  Gql.resolveField(User, {
    random: GetRandom
  }),
  Gql.withResolver(resolver)
)

Effect.never.pipe(
  Effect.provide(
    compile.pipe(
      Effect.provideService(Ctx.Schema, source),
      Effect.flatMap(runWithYoga([])),
      Effect.map(HttpServer.serve()),
      Layer.unwrapEffect
    ),
  ),
  Effect.provide(NodeHttpServer.layer(() => createServer(), { port: 8080 } )),
  Effect.provide(Logger.minimumLogLevel(LogLevel.All)),
  NodeRuntime.runMain,
)


// compile.pipe(
//   Effect.provideService(Ctx.Schema, source),
//   Effect.flatMap(runWithYoga([])),
//   Effect.flatMap(HttpServer.serveEffect()),
//   Effect.provide(NodeHttpServer.layer(() => createServer(), { port: 8080 } )),
//   Effect.provide(Logger.minimumLogLevel(LogLevel.All)),
//   Effect.tapError(Console.error),
//   Effect.scoped,
//   NodeRuntime.runMain,
// )


