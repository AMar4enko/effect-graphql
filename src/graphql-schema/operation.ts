import { Schema } from '@effect/schema'
import { Annotations, TaggedRequest } from '@effect/schema/Schema'

import { RequestMetadata } from './annotation'
import { deepPartial } from './misc'

export const Operation
  = <Self = never>(identifier?: string) =>
  <Tag extends string, Fields extends Schema.Struct.Fields, EA, EI, ER, AA, AI, AR>(
      tag: Tag,
      Failure: Schema.Schema<EA, EI, ER>,
      Success: Schema.Schema<AA, AI, AR>,
      fields: Fields,
      annotations?: Annotations.Schema<Self>,
    ) => TaggedRequest<Self>(identifier)(tag, Failure, deepPartial(Success), fields, {
      ...annotations,
      [RequestMetadata]: {
        tag,
        Success,
        fields,
      },
    })
