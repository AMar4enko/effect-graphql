import { AST, Schema } from '@effect/schema'
import { inspect } from 'bun'
import { Effect, Logger, LogLevel, pipe } from 'effect'
import { test } from 'vitest'

import * as Gql from '../../src/graphql-schema'
import { RequestMetadata } from '../../src/graphql-schema/annotation'
// import { declarationToScalar } from '../../src/graphql-schema/compile'
import { Operation } from '../../src/graphql-schema/operation'

// test.skip(`declarationToScalar`, () => {
//   declarationToScalar(new Map())(Schema.DateFromSelf.ast as AST.Declaration)
// })

test(`schema compilation`, () => {
  const Interface = Schema.Struct({
    id: Schema.Number,
  }).pipe(
    Gql.Interface.asInterface(`Interface`),
    Gql.Interface.exposeFields([`id`]),
  )

  class User extends Schema.TaggedClass<string>()(
    `User`,
    {
      name: Schema.String,
    },
  ).pipe(
    Gql.Object.extendsInterface(Interface),
    Gql.Object.exposeFields([`name`]),
  ) {}

  class GetCurrentUser extends Gql.Operation<GetCurrentUser>()(
    `getCurrentUser`,
    Schema.Number,
    User,
    {
      id: Schema.String,
    },
  ) {}

  console.log(inspect(User.ast))

  // const schema = pipe(
  //   Gql.empty(),
  //   Gql.query({
  //     currentUser: GetCurrentUser,
  //   }),
  //   Gql.compile,
  //   Logger.withMinimumLogLevel(LogLevel.Debug),
  //   Effect.runSync,
  // )

  // const UsersList = Schema.Array(User)

  // console.log(UsersList.ast)

  // const schema = Gql.compile()
})
