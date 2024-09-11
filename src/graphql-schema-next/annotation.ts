import { AST } from '@effect/schema'

// export const GqlInterfaceName = Symbol.for(`effect-graphql/GqlInterfaceId`)
export const ExtendsInterface = Symbol.for(`effect-graphql/ExtendsInterface`)
// export const GqlTypeId = Symbol.for(`GqlTypeId`)
// export const RequestMetadata = Symbol.for(`effect-graphql/RequestMetadata`)
// export const FieldResolvers = Symbol.for(`effect-graphql/FieldResolvers`)
export const DeprecationReason = Symbol.for(`effect-graphql/DeprecationReason`)
export const Reference = Symbol.for(`effect-graphql/Reference`)
export const SurrogateAnnotationId = (AST as any).SurrogateAnnotationId
export const PartialAST = Symbol.for(`effect-graphql/PartialAST`)