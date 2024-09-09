import { Schema } from "@effect/schema"
import { test, expectTypeOf } from "vitest";
import { ExtractSchemaFields } from "../schema"
import * as GraphQL from "../schema"

const t = <T>(): T => void 0 as any

class TestSchema extends Schema.TaggedClass<TestSchema>()(
  `TestSchema`,
  {
    name: Schema.String,
    age: Schema.Number,
  },
) {}

class GetAge extends Schema.TaggedRequest<GetAge>()(
  `Query.getAge`,
  {
    failure: Schema.String,
    success: Schema.Number,
    payload: {
      parent: TestSchema,
    }
  }
) {}

class GetName extends Schema.TaggedRequest<GetAge>()(
  `Query.getName`,
  {
    failure: Schema.String,
    success: Schema.String,
    payload: {
      parent: TestSchema,
    }
  }
) {}

test(`ExtractSchemaFields`, () => {
  const a = t<ExtractSchemaFields<typeof GetAge, false>>()
  expectTypeOf(
    a
  ).toEqualTypeOf<{
    parent: typeof TestSchema
  }>()
})

test(`WithRequestNewable`, () => {
  const a = t<
    GraphQL.Schema.WithRequestNewable<
      GraphQL.Schema.Definition<{}, {}, {}, GetName, never>, 
      typeof GetAge
    >
  >()

  expectTypeOf(a).toEqualTypeOf<GraphQL.Schema<GraphQL.Schema.Definition<{}, {}, {}, GetAge | GetName, never>>>()
})

test(`ResolveFieldFunction`, () => {
  const resolveField = t<GraphQL.ResolveFieldFunction>()

  const schema = GraphQL.make().pipe(
    resolveField(TestSchema, { age: GetAge }),
    resolveField(TestSchema, { name: GetName })
  )
  
  expectTypeOf(schema).toEqualTypeOf<GraphQL.Schema<GraphQL.Schema.Definition<{}, {}, {}, GetAge | GetName, never>>>()
})

test (`WithOperations`, () => {
  const a = t<
    GraphQL.Schema.WithOperations<
      GraphQL.Schema.Definition,
      { age: GetAge },
      `query`
    >
  >()

  const b = t<
    GraphQL.Schema.WithOperations<
      typeof a,
      { name: GetName },
      `query`
    >
  >()
})

test(`withQueries`, () => {
  const a = GraphQL.make().pipe(
    GraphQL.withQueries({
      getAge: GetAge,
    }),
    GraphQL.withQueries({
      getName: GetName,
    })
  )

  expectTypeOf(a).toEqualTypeOf<
    GraphQL.Schema<GraphQL.Schema.Definition<{ getAge: GetAge; getName: GetName }, {}, {}, GetAge | GetName, never>>
  >()
})