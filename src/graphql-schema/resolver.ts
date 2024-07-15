import { Request } from 'effect/Request'
import { Schema } from '@effect/schema'
import { TaggedRequest } from '@effect/schema/Schema'

import { GqlSchema, TaggedRequestNewable } from './types'
import { RequestResolver } from 'effect'

type ExtractClassFields<T> = T extends { fields: Schema.Struct.Fields } ? T['fields'] : never

type FieldResolver<
  Parent extends { fields: Schema.Struct.Fields },
  RequestNewable,
  Fields extends Schema.Struct.Fields,
  Key extends keyof Fields,
> =
  RequestNewable extends (new (...args: any[]) => infer I extends TaggedRequest.Any)
    ? ExtractClassFields<RequestNewable> extends { parent: Parent }
      ? I extends Request<Schema.Schema.Type<Fields[Key]>, any>
        ? RequestNewable
        : `Request result type does not match field <${Key extends string ? Key : ``}> type`
      : `Request fields must include parent field of resolved type`
    : never

export const resolveField = <
  S extends GqlSchema,
  A extends { fields: Schema.Struct.Fields },
  Requests extends { [key in Exclude<keyof A['fields'], '_tag'>]: FieldResolver<A, Requests[key], A['fields'], key> },
>(i: A, resolvers: Requests) => (s: S) => {
    const typeFields = s.type.get(i) ?? {}

    return {
      ...s,
      type: s.type.set(i, { ...typeFields, ...resolvers }),
    } satisfies GqlSchema
  }

export const resolveOperation = <
  S extends GqlSchema,
  Request extends TaggedRequestNewable<any>,
  Resolver extends RequestResolver.RequestResolver<Request>
>(req: Request, res: Resolver) => (s: S) => {
  return {
    ...s,
    resolver: new Map(s.resolver.set(req, res as any))
  } satisfies GqlSchema
}

export const query = <S extends GqlSchema>(op: { [key in string]: key extends keyof S['query'] ? `Query <${key}> already exists` : TaggedRequestNewable<any> }) => (s: GqlSchema) => ({
  ...s,
  query: { ...s.query, ...op },
} satisfies GqlSchema)
