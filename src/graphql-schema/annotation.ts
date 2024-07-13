import { AST, Schema } from '@effect/schema'

export const GqlInterfaceName = Symbol.for(`effect-graphql/GqlInterfaceId`)
export const GqlInterface = Symbol.for(`effect-graphql/GqlInterface`)
export const GqlTypeId = Symbol.for(`GqlTypeId`)
export const RequestMetadata = Symbol.for(`effect-graphql/RequestMetadata`)
export const FieldResolvers = Symbol.for(`effect-graphql/FieldResolvers`)
export const DeprecationReason = Symbol.for(`effect-graphql/DeprecationReason`)
export const SurrogateAnnotationId = (AST as any).SurrogateAnnotationId

export interface RequestMetadataType<Tag extends string = string, Fields extends Schema.Struct.Fields = {}, AA = any, AI = any, AR = any> {
  tag: Tag
  Success: Schema.Schema<AA, AI, AR>
  fields: Fields
}
