import { Option, Pipeable, Request, RequestResolver } from "effect"
import {} from "effect/Effectable"
import * as S from "@effect/schema"
import { Invariant } from "effect/Types"
import { TaggedRequest } from "@effect/schema/Schema"

export const TypeId: unique symbol = Symbol.for(`effect-graphql/Schema`)
export type TypeId = typeof TypeId

export type HasFields<F extends PropertyKey> = { fields: {[key in F]: S.Schema.Schema.All | S.Schema.PropertySignature.All } }

export interface Schema<in out D extends Schema.AnyDefinition> extends Schema.Proto<D> {}

export type OperationMap<K extends PropertyKey, V extends TaggedRequest.Any> = Record<K, V>
export type OperationType = `query` | `mutation` | `subscription`

export type SchemaWithFields<T extends PropertyKey = PropertyKey> = S.Schema.Any & HasFields<T>


export type InstanceFromNewable<T extends (new (...args: any[]) => any)> = 
  T extends (new (...args: any[]) => infer I)
  ? I
  : never

export interface TaggedRequestNewable<R extends TaggedRequest.Any> {
  new (props: any, disableValidation?: boolean): R

  ast: S.AST.AST
  fields: S.Schema.Struct.Fields
}

export declare namespace Schema {
  export interface Definition<
    QueryFields extends OperationMap<any, any> = OperationMap<never, never>, // Query fields
    MutationFields extends OperationMap<any, any> = OperationMap<never, never>, // Mutation fields  
    SubscriptionFields extends OperationMap<any, any> = OperationMap<never, never>, // Subscription fields
    Req extends TaggedRequest.Any = never,
    Schemas extends S.Schema.Schema.Any = never,
  > {
    readonly query: QueryFields
    readonly mutation: MutationFields
    readonly subscription: SubscriptionFields
    /**
     * Unified map of all operations
     * Keep track of queries via Schema ID to Request map
     * We can't use Schema ref itself here, because it might be transformed
     */
    readonly fieldQuery: Record<string, Req>
    readonly resolver: RequestResolver.RequestResolver<any, never>
  }

  export type AnyDefinition = Definition<any, any, any, any, any>

  export interface Proto<in out D extends AnyDefinition> extends Pipeable.Pipeable {
    readonly [TypeId]: Invariant<D>
    readonly definition: D
  }

  export type MergeOperations<A extends OperationMap<any, any>, B extends OperationMap<any, any>> = [A, B] extends [OperationMap<infer KeyA, infer ValueA>, OperationMap<infer KeyB, infer ValueB>]
    ? {
      [key in KeyA | KeyB]: key extends KeyA ? ValueA : ValueB
    }
    : never

  export type MergeReq<ReqA, ReqB> = [ReqA] extends [never] ? ReqB : ReqA | ReqB

  export type WithOperations<D extends AnyDefinition, F extends OperationMap<any, any>, Operation extends OperationType> = 
    [D] extends [Definition<infer Q, infer M, infer S, infer Req, infer Schemas>]
      ? [Operation] extends [`query`]
        ? Definition<MergeOperations<Q, F>, M, S, MergeReq<Req, F[keyof F]>, Schemas>
        : [Operation] extends [`mutation`]
          ? Definition<Q, MergeOperations<M, F>, S, MergeReq<Req, F[keyof F]>, Schemas>
          : [Operation] extends [`subscription`]
            ? Definition<Q, M, MergeOperations<S, F>, MergeReq<Req, F[keyof F]>, Schemas>
            : D
      : D

  export type WithRequestNewable<D extends AnyDefinition, R extends TaggedRequestNewable<any>> = 
    [D] extends [Definition<infer Q, infer M, infer S, infer Req, infer Schemas>]
      ? Schema<Definition<Q, M, S, [Req] extends [never] ? InstanceType<R> : Req | InstanceType<R>, Schemas>>
      : Schema<D>

  export type WithSchemas<Schemas extends S.Schema.Schema.Any, GqlSchema extends Schema<AnyDefinition>> = 
    [GqlSchema] extends [Schema<Definition<infer Q, infer M, infer S, infer Req, infer DefinitionSchemas>>]
      ? Schema<Definition<Q, M, S, Req, DefinitionSchemas & Schemas>>
      : GqlSchema
  
}

/**
 * @internal
 */
export const proto = {
  [TypeId]: (_: never) => _,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  }
}

export const make = (): Schema<Schema.Definition> => {
  return Object.create(proto)
}

export const withQueries = <Fields extends {[key in string]: TaggedRequest.Any }>(f: {[key in keyof Fields]: TaggedRequestNewable<Fields[key]>}) => 
  <D extends Schema.AnyDefinition>(schema: Schema<D>): Schema<Schema.WithOperations<D, Fields, `query`>> => {
  const o = Object.create(proto)
  o.definition = Object.freeze({
    ...schema.definition,
    query: f
  })

  return o
}

export const withMutations = <Fields extends {[key in string]: TaggedRequest.Any }>(f: {[key in keyof Fields]: TaggedRequestNewable<Fields[key]>}) => <D extends Schema.Definition>(schema: Schema<D>): Schema<Schema.WithOperations<D, Fields, `mutation`>> => {
  const o = Object.create(proto)
  o.definition = Object.freeze({
    ...schema.definition,
    mutation: f
  })

  return o
}

export const withResolver = (resolver: RequestResolver.RequestResolver<any>) => <D extends Schema.AnyDefinition>(schema: Schema<D>) => {
  const o = Object.create(proto)
  o.definition = Object.freeze({
    ...schema.definition,
    resolver
  })

  return o
}

type FieldResolver<
  Parent extends SchemaWithFields,
  R, // Request newable type
  K, // Field key
> =
  R extends TaggedRequestNewable<infer I> & { fields: infer F extends S.Schema.Struct.Fields }
    ? F extends { parent: Parent }
      ? K extends keyof Parent['fields']
        ? I extends Request.Request<S.Schema.Schema.Type<Parent['fields'][K]>, any>
          ? R
          : `Request result type does not match field <${K extends string ? K : ``}> type`
        : never
      : `Request fields must include parent field of resolved type`
    : never
  
export type ResolveFieldFunction = <
  D extends Schema.AnyDefinition,
  TargetSchema extends SchemaWithFields,
  Requests extends {
    [key in Exclude<keyof TargetSchema['fields'], `_tag`>]?: FieldResolver<TargetSchema, Requests[key], key>
  } & {[key in keyof Requests]: key extends keyof TargetSchema['fields'] ? Requests[key] : `Unknown schema field ${key extends string ? key : ``}` }
>(
  s: TargetSchema, 
  requests: Requests
) => (schema: Schema<D>) => Schema.WithRequestNewable<
  D, 
  Requests[keyof Requests] extends TaggedRequestNewable<any> 
    ? Requests[keyof Requests]
    : never
>


export const resolveField: ResolveFieldFunction = (schema, requests) => (gqlSchema) => {  

  const id = S.AST.getIdentifierAnnotation((schema as any).ast).pipe(Option.getOrThrowWith(() => new Error(`Schema ${schema} must have identifier annotation`)))

  const fieldQuery = {
    ...gqlSchema.definition.fieldQuery,
    ...Object.fromEntries(
      Object.entries(requests).map(([key, resolver]) => [`${id}.${key}`, resolver])
    )
  }

  const o = Object.create(proto)

  o.definition = {
    ...gqlSchema.definition,
    fieldQuery
  }

  return o
}
