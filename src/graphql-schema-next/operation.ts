import { Schema } from '@effect/schema'
import { Annotations, Struct, TaggedRequest } from '@effect/schema/Schema'
import { deepPartial } from './misc'

export const Operation
  = <Self = never>(identifier?: string) =>
    <Tag extends string, Payload extends Struct.Fields, Success extends Schema.Schema.Any, Failure extends Schema.Schema.Any>(
      tag: Tag,
      options: {
        failure: Failure
        success: Success
        payload: Payload
      },
      annotations?: Annotations.Schema<Self>,
    ) => TaggedRequest<Self>(identifier)(tag, { ...options, success: deepPartial(options.success) }, annotations)
