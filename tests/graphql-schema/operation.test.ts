import { Schema } from '@effect/schema'
import { test } from 'vitest'

import { asInterface } from '../../src/graphql-schema/interface'
import { extendsInterface } from '../../src/graphql-schema/object'
import { Operation } from '../../src/graphql-schema/operation'

test(`Operation`, () => {
  const Identifiable = Schema.Struct({ id: Schema.String })
    .pipe(
      asInterface(`Identifiable`),
    )

  class User extends Schema.TaggedClass<User>()(
    `User`,
    {
      name: Schema.String,
    }
  ).pipe(
    extendsInterface(Identifiable),
  ) {}

  // class User extends Schema.TaggedClass<string>()(
  //   `User`,
  //   {
  //     name: Schema.String,
  //   },
  // ).pipe(
  //   extendsInterface(Identifiable),
  // ) {}

  class GetUser extends Operation<GetUser>()(
    `getUser`,
    Schema.Never,
    User,
    {
      id: Schema.String,
    },
  ) {}
})
