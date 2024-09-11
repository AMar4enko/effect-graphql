import { describe, test } from 'vitest'
import { GqlType } from '../entity'
import { Schema } from '@effect/schema'

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