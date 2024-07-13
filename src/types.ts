import { Tags } from 'effect/Types'
import { AST, Schema } from '@effect/schema'
import { Annotations, Class, TaggedRequest } from '@effect/schema/Schema'
import { Effect, Request, Types } from 'effect'

export const GqlTypeId = Symbol.for(`GqlTypeId`)

export type AddDedupe<A extends Schema.Schema.Any, B extends Schema.Schema.Any[]> = A extends B[number]
  ? B
  : [...B, A]

export type ConcatDedupeItems<A extends Schema.Schema.Any[], B extends Schema.Schema.Any[]> = A extends [infer Head extends Schema.Schema.Any, ...infer Tail]
  ? AddDedupe<Head, Tail extends [Schema.Schema.Any] ? ConcatDedupeItems<Tail, B> : B>
  : B

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
}

export type WithQueryRequest<R extends TaggedRequestNewable<any>, S extends EmptyPothosSchema> =
  [S, R] extends [PothosSchema<infer Q extends { [key in string]: any }, infer _M, infer _S>, TaggedRequestNewable<infer TR>]
    ? keyof Q extends never
      ? PothosSchema<{ [key in Tags<TR>]: R }, _M, _S>
      : PothosSchema<{ [key in keyof Q | Tags<TR>]: key extends keyof Q ? Q[key] : R }, _M, _S>
    : S

export type WithMutationRequest<R extends TaggedRequestNewable<any>, S extends EmptyPothosSchema> =
  [S, R] extends [PothosSchema<infer _Q, infer M extends { [key in infer MT]: any }, infer _S>, TaggedRequestNewable<infer TR>]
    ? keyof M extends never
      ? PothosSchema<_Q, { [key in Tags<TR>]: R }, _S>
      : PothosSchema<_Q, { [key in MT | Tags<TR>]: key extends keyof M ? M[key] : R }, _S>
    : S

export interface PothosSchema<
  Query extends Record<string, TaggedRequestNewable<any>>,
  Mutation extends Record<string, TaggedRequestNewable<any>>,
  Subscription extends Record<string, TaggedRequestNewable<any>>,
> {
  type: Schema.Schema.Any[]
  query: Query
  mutation: Mutation
  subscription: Subscription
}

export type ResolverType<S extends EmptyPothosSchema, Op extends 'query' | 'mutation', T extends S[Op extends keyof S ? Op : never]> =
  S[Op][T extends keyof S[Op] ? T : never] extends TaggedRequestNewable<infer R>
    ? (r: R) => Effect.Effect<Request.Request.Success<R>, Request.Request.Error<R>>
    : never

// R extends Resolver<any, any, infer A, any, any, any> ? A : never

export type EmptyPothosSchema = PothosSchema<{}, {}, {}>

// export type AddTypes<Schema extends AnyPothosSchema, Types extends NonEmptyArray<Schema.Schema.Any>> =
//   Schema extends PothosSchema<infer T, infer _Q, infer _M, infer _R, infer _I>
//   ? PothosSchema<ConcatDedupeItems<T, Types>, _Q, _M, _R, _I>
//   : never

// export type AddInputs<Schema extends AnyPothosSchema, T extends NonEmptyArray<Schema.Schema.Any>> =
//   Schema extends PothosSchema<infer _T, infer _Q, infer _M, infer _R, infer IN>
//   ? PothosSchema<_T, _Q, _M, _R, ConcatDedupeItems<IN, T>>
//   : never

/**
 * For Input types, unlike with Schema decode, we're not gonna
 * receive type class instances, hence gonna remove them
 * Maybe useful in the future
 */
// export type UnwrapClasses<S> = S extends Schema.Schema.Any
//   ? UnwrapClasses<Schema.Schema.Type<S>>
//   : S extends string
//     ? S
//     : S extends readonly (infer A)[] | (infer A)[]
//       ? UnwrapClasses<A>[]
//       : S extends { [key in '_tag']: any }
//         ? UnwrapClasses<Omit<S, '_tag'>>
//         : S extends { [key in infer Keys]: any }
//           ? { [K in Keys]: UnwrapClasses<S[K]> }
//           : S

type MissingSelfGeneric<Usage extends string, Params extends string = ''> =
  `Missing \`Self\` generic - use \`class Self extends ${Usage}<Self>()(${Params}{ ... })\``

export const GqlOperation = <Self = never>(identifier?: string) =>
  <Tag extends string, Fields extends Schema.Struct.Fields, EA, EI, ER, AA, AI, AR>(
    tag: Tag,
    Failure: Schema.Schema<EA, EI, ER>,
    Success: Schema.Schema<AA, AI, AR>,
    fields: Fields,
    annotations?: Annotations.Schema<Self>,
  ): [Self] extends [never] ? MissingSelfGeneric<'TaggedRequest', `"Tag", SuccessSchema, FailureSchema, `>
    : Class<
      Self,
      { readonly _tag: Schema.literal<[Tag]> } & Fields,
      Types.Simplify<{ readonly _tag: Tag } & Schema.Struct.Type<Fields>>,
      Types.Simplify<{ readonly _tag: Tag } & Schema.Struct.Encoded<Fields>>,
      Schema.Struct.Context<Fields>,
      Types.Simplify<Schema.Struct.Type<Fields>>,
      TaggedRequest<
        Tag,
        Self,
        { readonly _tag: Tag } & Schema.Struct.Encoded<Fields>,
        Schema.Struct.Context<Fields>,
        AA,
        AI,
        EA,
        EI,
        ER | AR
      >,
      {}
    > => {
    return TaggedRequest<Self>()(
      tag,
      Failure,
      Success,
      fields,
      {
        ...annotations,
        jsonSchema: {
          ...annotations?.jsonSchema,
          schema: {
            failure: Failure,
            success: Success,
            tag: identifier ?? tag,
            fields,
          },
        },
      },
    )
    // return TaggedRequest<Self>()(
    //   tag,
    //   Failure,
    //   Success,
    //   fields,
    //   annotations,
    // )
  }
