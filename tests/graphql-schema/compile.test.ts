import { AST, Schema } from '@effect/schema'
import { Effect, Logger, LogLevel, pipe, RequestResolver } from 'effect'
import { expect } from 'vitest'

import * as Gql from '../../src/graphql-schema'
import { compile } from '../../src/graphql-schema/compile'
import { printSchema } from 'graphql'
import { it } from '@effect/vitest'
import { TaggedRequest } from '@effect/schema/Schema'


it.effect(`input compilation`, () => Effect.gen(function* () {
  const Identifiable = Schema.Struct({
    id: Schema.Number,
  }).pipe(
    Gql.Interface.asInterface(`Identifiable`)
  )

  class User extends Schema.TaggedClass<User>()(
    `User`,
    {
      name: Schema.String,
    },
  ).pipe(
    Gql.Object.extendsInterface(Identifiable)
  ) {}

  class Post extends Schema.TaggedClass<Post>()(
    `Post`,
    {
      content: Schema.String
    }
  ).pipe(
    Gql.Object.extendsInterface(Identifiable)
  ) {}

  class Story extends Schema.TaggedClass<Story>()(
    `Story`,
    {
      url: Schema.String
    }
  ).pipe(
    Gql.Object.extendsInterface(Identifiable)
  ) {}

  class Comment extends Schema.TaggedClass<Comment>()(
    `Comment`,
    {
      text: Schema.String,
      parent: Schema.Union(Story, Post)
    }
  ).pipe(
    Gql.Object.extendsInterface(Identifiable)
  ) {}

  const Pagination = Schema.partial(Schema.Struct({
    cursor: Schema.String
  })).pipe(
    Schema.annotations({ identifier: `Pagination` })
  )

  class GetCurrentUser extends Gql.Operation<GetCurrentUser>()(
    `getCurrentUser`,
    Schema.Number,
    Schema.Union(User, Schema.Undefined),
    {
      pagination: Pagination,
    },
  ) {}

  class GetUserPosts extends Gql.Operation<GetUserPosts>()(
    `userPosts`,
    Schema.Number,
    Schema.Array(Post),
    {}
  ) {}

  class GetComments extends Gql.Operation<GetComments>()(
    `userComments`,
    Schema.Number,
    Schema.Array(Comment),
    {
      since: Schema.DateFromString
    }
  ) {}

  class GetId extends Gql.Operation<GetId>()(
    `getId`,
    Schema.Number,
    Schema.Number,
    {
      parent: Identifiable
    }
  ) {}

  class Test extends TaggedRequest<Test>()(
    `Test`,
    Schema.Number,
    Schema.String,
    {
      id: Schema.String
    }
  ) {}

  const source = pipe(
    Gql.empty(),
    Gql.query({
      currentUser: GetCurrentUser,
      myPosts: GetUserPosts,
      comments: GetComments
    }),
    Gql.resolveField(Identifiable, {
      id: GetId
    })
  )

  const schema = yield* compile.pipe(
    Effect.provideService(Gql.GqlSchema, source),
    Logger.withMinimumLogLevel(LogLevel.All),
    Effect.map(printSchema)
  )

  expect(schema).toEqual(
`type Query {
  currentUser(pagination: Pagination!): User
  myPosts: [Post!]!
  comments(since: DateFromString!): [Comment!]!
}

type User implements Identifiable {
  """a string"""
  name: String!

  """a number"""
  id: Float!
}

interface Identifiable {
  """a number"""
  id: Float!
}

input Pagination {
  cursor: String
}

type Post implements Identifiable {
  """a string"""
  content: String!

  """a number"""
  id: Float!
}

type Comment implements Identifiable {
  """a string"""
  text: String!

  """a number"""
  id: Float!
  parent: Story_Post!
}

union Story_Post = Story | Post

type Story implements Identifiable {
  """a string"""
  url: String!

  """a number"""
  id: Float!
}

scalar DateFromString`
  )
}))
