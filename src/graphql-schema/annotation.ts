import { AST, Schema } from '@effect/schema'
import { Effect, Option } from 'effect'
import { TaggedRequestNewable } from './types'

export const GqlInterfaceName = Symbol.for(`effect-graphql/GqlInterfaceId`)
export const GqlInterface = Symbol.for(`effect-graphql/GqlInterface`)
export const GqlTypeId = Symbol.for(`GqlTypeId`)
export const RequestMetadata = Symbol.for(`effect-graphql/RequestMetadata`)
export const FieldResolvers = Symbol.for(`effect-graphql/FieldResolvers`)
export const DeprecationReason = Symbol.for(`effect-graphql/DeprecationReason`)
export const Reference = Symbol.for(`effect-graphql/Reference`)
export const SurrogateAnnotationId = (AST as any).SurrogateAnnotationId

export interface RequestMetadata<Tag extends string = string, Fields extends Schema.Struct.Fields = {}, AA = any, AI = any, AR = any> {
  tag: Tag
  Success: Schema.Schema<AA, AI, AR>
  fields: Fields
}

export const getOperationMetadata = (req: TaggedRequestNewable<any>) => {
  return req.ast._tag === `Transformation`
    ? AST.getAnnotation<RequestMetadata>(RequestMetadata)(req.ast.to).pipe(
        Effect.orDieWith(() => new Error(`No metadata for ${req}`))
      )
    : Effect.fail(new Error(`TaggedRequestNewable expected ${req}`))
}

