import { dual } from 'effect/Function'
import { AST, Schema } from '@effect/schema'
import { Declaration, IndexSignature, PropertySignature as _PropertySignature, partial as _partial, PropertySignatureTransformation, Suspend, Transformation, TupleType, TypeLiteral, undefinedKeyword, Union, OptionalType } from '@effect/schema/AST'
import { isSchema, make } from '@effect/schema/Schema'
import { identity, Option } from 'effect'
import { createHash } from 'node:crypto'
import { Reference } from './annotation'

export const exposeKey = (a: any, key: string) => a[key]

const SurrogateAnnotationId = (AST as any).SurrogateAnnotationId as unknown as symbol

(exposeKey as any).sync = true

const orUndefined = (ast: AST.AST): AST.AST => Union.make([ast, undefinedKeyword])

type BuiltIns = Date | any[]

export type DeepPartial<A, Options extends { readonly exact: true } | undefined> =
  A extends BuiltIns
    ? A
    : A extends { [key in keyof A]: A[key] }
      ? { [K in keyof A]?: DeepPartial<A[K], Options> | ([undefined] extends [Options] ? undefined : never) }
      : never

type DeepPartialSchema<S, Options extends { readonly exact: true } | undefined> = S extends Schema.Schema<infer A, infer I, infer R>
  ? Schema.Schema<
      DeepPartial<A, Options>,
      DeepPartial<I, Options>,
      R
    >
  : S extends Schema.optional<Schema.Schema<infer A, infer I, infer R>>
    ? Schema.optional<Schema.Schema<
        DeepPartial<A, Options>,
        DeepPartial<I, Options>,
        R
      >>
    : S

const astReference = (ast: AST.AST) => {
  const hash = createHash(`sha256`, ) 

  hash.update(JSON.stringify(ast))

  return hash.digest().toString(`hex`)
}


const deepPartialAst = (ast: AST.AST, options?: { readonly exact: true }): AST.AST => {
  const exact = true
  switch (ast._tag) {
    case `TupleType`:
      return new TupleType(
        ast.elements.map(e => new OptionalType(exact ? deepPartialAst(e.type) : orUndefined(e.type), true)),
        ast.rest.map(e => new OptionalType(exact ? deepPartialAst(e.type) : orUndefined(e.type), true)),
        ast.isReadonly,
        ast.annotations
      )
    case `TypeLiteral`:
      return new TypeLiteral(
        ast.propertySignatures.map(ps =>
          new _PropertySignature(ps.name, exact ? deepPartialAst(ps.type) : orUndefined(deepPartialAst(ps.type)), true, ps.isReadonly, ps.annotations),
        ),
        ast.indexSignatures.map(is => new IndexSignature(is.parameter, orUndefined(is.type), is.isReadonly)),
        { ...ast.annotations, [Reference]: astReference(ast) }
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
        { ...ast.annotations, [Reference]: astReference(ast) }
      )
    case `Refinement`:
      return ast
    case `Transformation`: {
      const to = AST.getAnnotation(ast.to, SurrogateAnnotationId).pipe(Option.getOrElse(() => ast.to)) as unknown as AST.AST

      return new Transformation(
        deepPartialAst(ast.from, options),
        deepPartialAst(ast.to, options),
        ast.transformation,
        { ...ast.annotations, [Reference]: astReference(ast) }
      )
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