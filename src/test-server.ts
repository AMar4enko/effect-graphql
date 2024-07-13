import { Schema } from '@effect/schema'
import SchemaBuilder from '@pothos/core'
import { pipe } from 'effect'
import { createYoga } from 'graphql-yoga'

import { queryRequest } from './pothos-schema/resolvers'
import { compileExhaustive } from './compiler'
import { empty } from './schema-builder'
import { GqlOperation } from './types'

const Client = Schema.struct({
  name: Schema.string,
  id: Schema.string,
}).annotations({
  identifier: `Client`,
})

const User = Schema.struct({
  name: Schema.string,
  age: Schema.number,
  client: Schema.array(Client),
}).annotations({
  identifier: `User`,
})

class GetUser extends GqlOperation<GetUser>()(
  `getUser`,
  Schema.never,
  User,
  {
    id: Schema.string,
  },
) {}

const builder = pipe(
  empty(),
  queryRequest(GetUser),
  s => (s.type.push(Client, User), s),
  compileExhaustive(new SchemaBuilder({})),
)

const yoga = createYoga({ schema: builder.toSchema() })

const server = Bun.serve({
  fetch: yoga,
  port: 9999,
})

console.info(
  `Server is running on ${new URL(
    yoga.graphqlEndpoint,
    `http://${server.hostname}:${server.port}`,
  )}`,
)
