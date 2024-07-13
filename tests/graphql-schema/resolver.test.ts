import { Schema } from '@effect/schema'
import { test } from 'vitest'

import { resolve } from '../../src/graphql-schema/resolver'

test(`resolveInterface`, () => {
  const TestInterface = Schema.Struct({
    id: Schema.DateFromSelf,
  })

  class TestObject extends Schema.TaggedClass<string>()(
    `TestObject`,
    {
      id: Schema.Number,
    },
  ) {}

  class InterfaceReq extends Schema.TaggedRequest<InterfaceReq>()(
    `id`,
    Schema.Number,
    Schema.DateFromSelf,
    {
      parent: TestInterface,
    },
  ) {}

  class ObjectReq extends Schema.TaggedRequest<InterfaceReq>()(
    `id`,
    Schema.Number,
    Schema.Number,
    {
      parent: TestObject,
      args: Schema.Struct({ id: Schema.Number }),
    },
  ) {}

  resolve(TestInterface, {
    id: InterfaceReq,
  })

  resolve(TestObject, {
    id: ObjectReq,
  })
})
