import { AST, Schema } from '@effect/schema'
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