import { Schema } from '@effect/schema'
import { Effect } from 'effect'

import { deepPartial } from './src/graphql-schema/misc'

Effect.succeed(1).pipe(
  Effect.tap(() => 1),
)

const TestStruct = Schema.Struct({
  field: Schema.String,
})

class TestClass extends Schema.TaggedClass<TestClass>()(
  `TestTag`,
  {
    name: Schema.String,
    s: TestStruct,
  },
) {}

const a = deepPartial(TestClass)
