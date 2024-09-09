import { Schema } from "@effect/schema"
import { describe, test, vitest } from "vitest"
import * as GraphQL from '../schema.js'
import { extendSchema } from "graphql"

describe(`Schema`, () => {
  test(`makes sense`, () => {
    class User extends Schema.TaggedClass<User>()(
      `User`,
      {
        name: Schema.String,
        age: Schema.Number,
      },
    ) {}

    class Post extends Schema.TaggedClass<Post>()(
      `Post`,
      {
        content: Schema.String,
      },
    ) {}

    class GetUsers extends Schema.TaggedRequest<GetUsers>()(
      `getUsers`,
      {
        failure: Schema.String,
        success: Schema.Array(User),
        payload: {
          age: Schema.optional(Schema.Number),
        },
      }
    ) {}

    const schema = GraphQL.make().pipe(
      GraphQL.withQueries({
        getUsers: GetUsers,
      })
    )

  })

  test(`some types`, () => {
    class Post extends Schema.TaggedClass<Post>()(
      `Post`,
      {
        content: Schema.String,
        name: Schema.String,
      },
    ) {}

    class GetContent extends Schema.TaggedRequest<GetContent>()(
      `GetContent`,
      {
        failure: Schema.String,
        success: Schema.String,
        payload: {
          parent: Post,
        }
      }
    ) {}

    class GetName extends Schema.TaggedRequest<GetName>()(
      `GetName`,
      {
        failure: Schema.String,
        success: Schema.String,
        payload: {
          parent: Post,
        }
      }
    ) {}

    GraphQL.make().pipe(
      GraphQL.resolveField(Post, { content: GetContent })
    )
  })
})