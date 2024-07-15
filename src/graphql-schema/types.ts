import { GenericTag, Tag } from 'effect/Context'
import { AST, Schema } from '@effect/schema'
import { TaggedRequest } from '@effect/schema/Schema'
import { Effect, Request, RequestResolver } from 'effect'
import { GraphQLScalarType, GraphQLInterfaceType, GraphQLObjectType, GraphQLInputObjectType, ThunkObjMap, GraphQLFieldConfig, GraphQLEnumType, GraphQLInputType, GraphQLType } from 'graphql'

export type AnyClass = Schema.Class<any, any, any, any, any, any, any>

export type Resolver<Parent, Ctx, A, E, R, ArgsSchema extends Schema.Schema.Any> =
  (parent: Parent, ctx: Ctx) => Effect.Effect<A, E, R> |
  { (args: Schema.Schema.Type<ArgsSchema>, parent: Parent, ctx: Ctx): Effect.Effect<A, E, R>; args: ArgsSchema }

export interface PothosOperation<Output extends Schema.Schema.Any, Input extends Schema.Schema.Any = never, Err = never, R = never> {
  Output: Output
  Input: Input
  resolver: (args: { input: Schema.Schema.Type<Input>; output: Schema.Schema.Type<Output> }) => Effect.Effect<Schema.Schema.Type<Output>, Err, R>
}

export type ResolveFields<F extends Schema.Struct.Fields, Parent = never, Ctx = unknown> =
  Partial<{ [K in keyof F]: Resolver<Parent, Ctx, Schema.Schema.Type<F[K]>, any, any, any> }>

export type Resolvers = { [key in string]: (...args: any[]) => Effect.Effect<any, any, any> }

export type ResolversContext<R> = R extends { [key in string]: (...args: any[]) => Effect.Effect<any, any, infer C> }
  ? C
  : never

export interface TaggedRequestNewable<R extends TaggedRequest.Any> {
  new (props: any, disableValidation?: boolean): R

  ast: AST.AST
  fields: Schema.Struct.Fields
}

export interface GqlSchema<
  Type extends Map<any, { [key in string]: TaggedRequestNewable<any> }> = Map<any, { [key in string]: TaggedRequestNewable<any> }>,
  Query extends Record<string, TaggedRequestNewable<any>> = Record<never, TaggedRequestNewable<any>>,
  Mutation extends Record<string, TaggedRequestNewable<any>> = Record<never, TaggedRequestNewable<any>>,
  Subscription extends Record<string, TaggedRequestNewable<any>> = Record<never, TaggedRequestNewable<any>>,
  RequestResolver extends Map<TaggedRequestNewable<any>, RequestResolver.RequestResolver<TaggedRequestNewable<any>, any>> = Map<TaggedRequestNewable<any>, RequestResolver.RequestResolver<TaggedRequestNewable<any>, any>>,
  CtxTag extends Tag<any, any> | undefined = undefined,
> {
  type: Type
  query: Query
  mutation: Mutation
  subscription: Subscription
  resolver: RequestResolver
  ctxTag?: CtxTag
}

export const GqlSchema = GenericTag<GqlSchema>(`effect-graphql/source-schema`)

export type ResolverType<S extends GqlSchema, Op extends 'query' | 'mutation', T extends S[Op extends keyof S ? Op : never]> =
  S[Op][T extends keyof S[Op] ? T : never] extends TaggedRequestNewable<infer R>
    ? (r: R) => Effect.Effect<Request.Request.Success<R>, Request.Request.Error<R>>
    : never

/**
 * For Input types, unlike with Schema decode, we're not gonna
 * receive type class instances, hence gonna remove them
 * Maybe useful in the future
 */
export type UnwrapClasses<S> = S extends Schema.Schema.Any
  ? UnwrapClasses<Schema.Schema.Type<S>>
  : S extends string
    ? S
    : S extends readonly (infer A)[] | (infer A)[]
      ? UnwrapClasses<A>[]
      : S extends { [key in '_tag']: any }
        ? UnwrapClasses<Omit<S, '_tag'>>
        : S extends { [key in infer Keys]: any }
          ? { [K in Keys]: UnwrapClasses<S[K]> }
          : S

export interface GqlSchemaCache {
  ast: WeakMap<AST.AST, any>
  id: Map<string, any>
  idx: number
}