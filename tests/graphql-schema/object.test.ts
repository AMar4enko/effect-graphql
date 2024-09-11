import { AST, Schema } from '@effect/schema'
import { Effect, Match, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { FieldResolvers, GqlInterface } from '../../src/graphql-schema/annotation'
import { asInterface, getInterfaceFields } from '../../src/graphql-schema/interface'
import { exposeKey } from '../../src/graphql-schema/misc'
import { exposeFields, extendsInterface } from '../../src/graphql-schema/object'

export enum Test {
  A = `A`,
  B = `B`,
}

test(`extendsInterface`, () => {
  const Identifiable = Schema.Struct({ id: Schema.String })
    // .pipe(
    //   asInterface(`Identifiable`),
    // )

  const Timestamps = Schema.Struct({ updatedAt: Schema.DateFromSelf })
    .pipe(
      asInterface(`Timestamps`),
    )

  class User extends Schema.TaggedClass<User>()(
    `User`,
    {
      name: Schema.String,
    },
  ).pipe(
    extendsInterface(Identifiable),
    // extendsInterface(Timestamps),
  ) {}

  expect(new User({ name: `John`, id: `1`, updatedAt: new Date() })).toMatchObject({
    name: `John`,
    id: `1`,
    updatedAt: expect.any(Date),
  })

  expect(
    getInterfaceFields(User),
  ).toMatchObject([{ name: `id` }, { name: `updatedAt` }])
})

test(`exposeFields`, () => {
  class User extends Schema.TaggedClass<string>()(
    `User`,
    {
      name: Schema.String,
      email: Schema.String,
      id: Schema.Number,
    },
  ).pipe(
    exposeFields([`name`, `id`]),
  ) {}

  Match.type<AST.AST>().pipe(
    Match.tag(`Transformation`, (t) => {
      const resolvers = AST.getAnnotation(t.to, FieldResolvers)
      expect(resolvers).toMatchObject(Option.some({
        name: exposeKey,
        id: exposeKey,
      }))
    }),
    Match.orElseAbsurd,
  )(User.ast)
})
