import { describe, test } from 'vitest'
import { GqlInterface, GqlType } from '../entity'
import { Schema } from '@effect/schema'
import { TaggedClass } from '@effect/schema/Schema'

describe(`GqlType`, () => {
  test(`partial`, () => {
    class HasContent extends GqlInterface<HasContent>()(
      `HasContent`,
      {
        content: Schema.String,
      }
    ) {}


    class Comment extends GqlType<Comment>()(
      `Comment`,
      {},
      [HasContent]
    ) {}


    new Comment({ content: `string` })

    class Post extends GqlType<Post>()(
      `Post`,
      {
        content: Schema.String,
        comments: Schema.Array(Comment),
      }
    ) {}
    class User extends GqlType<User>()(
      `User`,
      {
        date: Schema.DateFromString,
        name: Schema.String,
        age: Schema.Number,
        posts: Schema.Array(Post),
      }
    ) {}

    const u = new User.partial({ 
      name: `Whatever`, 
      date: new Date(),
      posts: [
        { _tag: `Post`, content: `Hello` },
        { 
          _tag: `Post`,
          comments: [
            {
              _tag: `Comment`,
              content: `string`
            }
          ]
        }
      ]
    })

    const encodePartial = Schema.encodeSync(User.partial)
    const decodePartial = Schema.decodeSync(User.partial)


    console.log(Schema.encodeSync(User.partial)(u))
    console.log(Schema.decodeUnknownSync(User.partial)({ _tag: `User`, name: `Whatever`, date: `2020-01-01T00:00:00` }))

  })
})