import { Schema } from '@effect/schema'
import { expect, test } from 'vitest'

import * as misc from '../../src/graphql-schema/misc'

test(`deepPartial`, () => {
  const Struct = Schema.Struct({
    id: Schema.String,
    date: Schema.DateFromString,
  })

  class Obj extends Schema.TaggedClass<Obj>()(
    `Obj`,
    {
      name: Schema.String,
      s: Struct,
    },
  ) {}

  const Partial = misc.deepPartial(Obj)

  const parsePartial = Schema.decodeSync(Partial, { errors: `all` })
  const encodePartial = Schema.encodeSync(Partial)

  expect(
    parsePartial({ _tag: `Obj`, s: { date: `2020-01-01T00:00:00` } }),
  ).toEqual({
    _tag: `Obj`,
    s: {
      date: new Date(`2020-01-01T00:00:00`),
    },
  })

  expect(
    encodePartial({ _tag: `Obj`, s: { date: new Date(`2020-01-01T00:00:00`) } }),
  ).toEqual({
    _tag: `Obj`,
    s: {
      date: `2020-01-01T00:00:00.000Z`,
    },
  })
})
