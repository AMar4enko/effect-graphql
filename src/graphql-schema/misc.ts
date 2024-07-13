import { dual } from 'effect/Function'
import { AST, Schema } from '@effect/schema'
import { Declaration, Element, IndexSignature, isTypeLiteralTransformation, partial as _partial, PropertySignature, PropertySignatureTransformation, Suspend, Transformation, TupleType, TypeLiteral, undefinedKeyword, Union } from '@effect/schema/AST'
import { isSchema, make } from '@effect/schema/Schema'
import { Array as Arr, identity, Option } from 'effect'

import { GqlSchema } from './types'

export const exposeKey = (a: any, key: string) => a[key]

const SurrogateAnnotationId = (AST as any).SurrogateAnnotationId as unknown as symbol

(exposeKey as any).sync = true

const orUndefined = (ast: AST.AST): AST.AST => Union.make([ast, undefinedKeyword])

const isRenamingPropertySignatureTransformation = (t: PropertySignatureTransformation) =>
  t.decode === identity && t.encode === identity

type BuiltIns = Date | any[]

export type DeepPartial<A, Options extends { readonly exact: true } | undefined> =
// A extends { _tag: any }
  // ? { [K in keyof A]?: DeepPartial<A[K], Options> | ([undefined] extends [Options] ? undefined : never) }
  A extends BuiltIns
    ? A
    : A extends { [key in keyof A]: A[key] }
      ? { [K in keyof A]?: DeepPartial<A[K], Options> | ([undefined] extends [Options] ? undefined : never) }
      : never

type DeepPartialSchema<S, Options extends { readonly exact: true } | undefined> = S extends Schema.Schema<infer A, infer I, infer R> ?
  Schema.Schema<
    DeepPartial<A, Options>,
    DeepPartial<I, Options>,
    R
  > :
  S

const deepPartialAst = (ast: AST.AST, options?: { readonly exact: true }): AST.AST => {
  const exact = options?.exact === true
  switch (ast._tag) {
    case `TupleType`:
      return new TupleType(
        ast.elements.map(e => new Element(exact ? deepPartialAst(e.type) : orUndefined(e.type), true)),
        Arr.match(ast.rest, {
          onEmpty: () => ast.rest,
          onNonEmpty: rest => [Union.make([...rest, undefinedKeyword])],
        }),
        ast.isReadonly,
      )
    case `TypeLiteral`:
      return new TypeLiteral(
        ast.propertySignatures.map(ps =>
          new PropertySignature(ps.name, exact ? deepPartialAst(ps.type) : orUndefined(deepPartialAst(ps.type)), true, ps.isReadonly, ps.annotations),
        ),
        ast.indexSignatures.map(is => new IndexSignature(is.parameter, orUndefined(is.type), is.isReadonly)),
      )
    case `Union`:
      return Union.make(ast.types.map(member => deepPartialAst(member, options)))
    case `Suspend`:
      return new Suspend(() => deepPartialAst(ast.f(), options))
    case `Declaration`:
      return new Declaration(
        ast.typeParameters.map(ast => deepPartialAst(ast, options)),
        ast.decodeUnknown,
        ast.encodeUnknown,
      )
    case `Refinement`:
      return ast
    case `Transformation`: {
      // if (
      //   isTypeLiteralTransformation(ast.transformation)
      // ) {
      const to = AST.getAnnotation(ast.to, SurrogateAnnotationId).pipe(Option.getOrElse(() => ast.to)) as unknown as AST.AST

      return new Transformation(
        deepPartialAst(ast.from, options),
        deepPartialAst(to, options),
        ast.transformation,
      )
      // const transformTo = AST.getAnnotation(ast.to, SurrogateAnnotationId).pipe(Option.getOrElse(() => ast.to)) as unknown as AST.AST
      // console.log(ast, transformTo)
      // return deepPartialAst(transformTo, options)
      // return new Transformation(
      //   deepPartialAst(ast.from, options),
      //   deepPartialAst(transformTo, options),
      //   ast.transformation,
      // )
      // }

      // return ast
    }
  }
  return ast
}

export const deepPartial: {
  <const Options extends { readonly exact: true } | undefined>(
    options?: Options
  ): <A, I, R>(
    self: Schema.Schema<A, I, R>
  ) => DeepPartialSchema<typeof self, Options>
  <A, I, R, const Options extends { readonly exact: true } | undefined>(
    self: Schema.Schema<A, I, R>,
    options?: Options
  ): DeepPartialSchema<typeof self, Options>
} = dual(args => isSchema(args[0]), <A, I, R>(
  self: Schema.Schema<A, I, R>,
  options?: { readonly exact: true },
): DeepPartialSchema<typeof self, typeof options> => make(deepPartialAst(self.ast, options)))

export const empty = (): GqlSchema.Empty => ({
  mutation: {},
  type: new Map(),
  query: {},
  subscription: {},
  resolver: {},
})