import { Schema } from '@effect/schema'
import { Effect, Logger, LogLevel, pipe } from 'effect'

import * as Gql from '../schema.js'
import { compile } from '../compile/index.js'
import { printSchema } from 'graphql'
import { it } from '@effect/vitest'
import { Operation } from '../operation.js'
import * as Ctx from '../compile/context.js'


it.effect(`schema compilation`, () => Effect.gen(function* () {
  // const Identifiable = Schema.Struct({
  //   id: Schema.Number,
  // }).pipe(
  //   Gql.Interface.asInterface(`Identifiable`)
  // )

  class User extends Schema.TaggedClass<User>()(
    `User`,
    {
      name: Schema.String,
    },
  ) {}

  // class Post extends Schema.TaggedClass<Post>()(
  //   `Post`,
  //   {
  //     content: Schema.String
  //   }
  // ).pipe(
  //   Gql.Object.extendsInterface(Identifiable)
  // ) {}

  // class Story extends Schema.TaggedClass<Story>()(
  //   `Story`,
  //   {
  //     url: Schema.String
  //   }
  // ).pipe(
  //   Gql.Object.extendsInterface(Identifiable)
  // ) {}

  // class Comment extends Schema.TaggedClass<Comment>()(
  //   `Comment`,
  //   {
  //     text: Schema.String,
  //     parent: Schema.Union(Story, Post)
  //   }
  // ).pipe(
  //   Gql.Object.extendsInterface(Identifiable)
  // ) {}

  const Pagination = Schema.partial(Schema.Struct({
    cursor: Schema.String
  })).pipe(
    Schema.annotations({ identifier: `Pagination` })
  )

  class GetCurrentUser extends Operation<GetCurrentUser>()(
    `getCurrentUser`,
    {
      failure: Schema.Number,
      success: Schema.Union(User, Schema.Undefined),
      payload: {
        pagination: Pagination
      },
    }
  ) {}

  const source = pipe(
    Gql.make(),
    Gql.withQueries({
      currentUser: GetCurrentUser,
    }),
  )

  const schema = yield* compile.pipe(
    Effect.provideService(Ctx.Schema, source),
    Logger.withMinimumLogLevel(LogLevel.All),
    Effect.map(printSchema)
  )

//   expect(schema).toEqual(
// `type Query {
//   currentUser(pagination: Pagination!): User
//   myPosts: [Post!]!
//   comments(since: DateFromString!): [Comment!]!
// }

// type User implements Identifiable {
//   """a string"""
//   name: String!

//   """a number"""
//   id: Float!
// }

// interface Identifiable {
//   """a number"""
//   id: Float!
// }

// input Pagination {
//   cursor: String
// }

// type Post implements Identifiable {
//   """a string"""
//   content: String!

//   """a number"""
//   id: Float!
// }

// type Comment implements Identifiable {
//   """a string"""
//   text: String!

//   """a number"""
//   id: Float!
//   parent: Story_Post!
// }

// union Story_Post = Story | Post

// type Story implements Identifiable {
//   """a string"""
//   url: String!

//   """a number"""
//   id: Float!
// }

// scalar DateFromString`
//   )
}))
