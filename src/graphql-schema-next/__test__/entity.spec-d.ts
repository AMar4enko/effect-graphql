import { describe, expectTypeOf, test } from 'vitest'
import { GqlType, MergeAllFields, MergeFields } from '../entity'
import { Schema } from '@effect/schema'
import { tag } from '@effect/schema/Schema'

describe(`GqlType`, () => {
  test(`partial`, () => {
    class Posts extends GqlType<Posts>()(
      `Posts`,
      {
        content: Schema.String,
      }
    ) {}

    class RecentPosts extends GqlType<RecentPosts>()(
      `RecentPosts`,
      {
        lastDay: Schema.Array(Posts),
        lastWeek: Schema.Array(Posts),
      }
    ) {}

    class User extends GqlType<User>()(
      `User`,
      {
        name: Schema.String,
        age: Schema.Number,
        posts: Schema.Array(Posts),
        recentPosts: RecentPosts,
      }
    ) {}

    new RecentPosts.partial({
      lastDay: [
        { 
          _tag: `Posts`
        }
      ]
    })


    const b = new User.partial({ })
  })

  test(`MergeFields`, () => {
    const a = {
      a: Schema.Number
    }
    const b = {
      b: Schema.Number
    }

    type A = MergeFields<typeof a, typeof b>

    expectTypeOf<MergeFields<typeof a, typeof b>>().toEqualTypeOf<{
      a: typeof Schema.Number
      b: typeof Schema.Number
    }>()
  })

  test(`MergeAllFields`, () => {
    const a = {
      _tag: tag(`A`),
      a: Schema.Number
    }
    const b = {
      _tag: tag(`B`),
      b: Schema.Number
    }
    const c = {
      _tag: tag(`C`),
      b: Schema.Number
    }

    expectTypeOf<MergeAllFields<typeof a, [typeof b]>>().toEqualTypeOf<{
      _tag: Schema.tag<`A`>,
      a: typeof Schema.Number
      b: typeof Schema.Number
    }>()
  })
})