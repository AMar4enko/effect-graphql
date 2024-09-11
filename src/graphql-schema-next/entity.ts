import { AST, Schema } from '@effect/schema'
import { Class, extend, keyof, makePropertySignature, PropertySignature, PropertySignatureTransformation } from '@effect/schema/Schema'
import { Struct, TaggedClass, Annotations, tag, optional, PropertySignatureDeclaration, isSchema, isPropertySignature, Schema as _S } from '@effect/schema/Schema'
import { Option, Record as R } from 'effect'
import { BuiltIns } from 'type-fest/source/internal/type'
import { ExtendsInterface, PartialAST } from './annotation'
import { OptionalType, Type as type } from '@effect/schema/AST'
import { Simplify } from 'effect/Types'

export type DeepPartial<A> =
  A extends BuiltIns
    ? A
    : A extends {readonly [key in number]: infer B}
      ? Readonly<Array<DeepPartial<B>>>
      : A extends { [key in PropertyKey]: any }
        ? { [key in Exclude<keyof A, '_tag'>]?: DeepPartial<A[key]> } & { [key in '_tag']: key extends keyof A ? A[key] : never }
        : A extends { [key in infer K]: any }
          ? { [key in K]?: DeepPartial<A[key]> }
          : A

type MissingSelfGeneric<Usage extends string, Params extends string = ""> =
  `Missing \`Self\` generic - use \`class Self extends ${Usage}<Self>()(${Params}{ ... })\``

export const GqlInterfaceTypeId: unique symbol = Symbol.for("effect-graphql/Interface")
export const GqlTypeTypeId: unique symbol = Symbol.for("effect-graphql/Type")

export type GqlTypeFields = {
  readonly [x: PropertyKey]:
    | AnyGqlInterface
    | AnyGqlType
    | _S.All
    | PropertySignature.All
}

export type PartialSchema<A> = 
  A extends { partial: infer P }
    ? P
    : A extends Schema.Array$<infer S>
      ? Schema.Array$<PartialSchema<S>>
      : A

export type OptionalPropertySignature<A extends PropertySignature.All | _S.All> =
  A extends PropertySignature<infer Token, infer Type, infer Key, infer EncodedToken, infer EncodedType, infer HasDefault, infer R>
    ? PropertySignature<
      "?:",
      PartialSchema<Type>,
      never,
      "?:",
      PartialSchema<EncodedType>,
      HasDefault,
      R
    >
    : A extends _S.All 
      ? PropertySignature<
        "?:",
        _S.Type<PartialSchema<A>>,
        never,
        "?:",
        _S.Encoded<PartialSchema<A>>,
        false,
        _S.Context<A>
      >
      : never

export type PartialFields<Fields extends Struct.Fields> = {
  [key in keyof Fields]: [key] extends ['_tag'] 
    ? Fields[key]
    : OptionalPropertySignature<Fields[key]>
}

export type MergeFields<A extends GqlTypeFields, B extends GqlTypeFields> = 
  Simplify<
    A & Omit<B, `_tag`>
  > extends GqlTypeFields
  ? Simplify<
    A & Omit<B, `_tag`>
  >
  : never 

export type MergeAllFields<A extends GqlTypeFields, InterfaceFields extends Array<GqlTypeFields>> = 
  InterfaceFields extends [infer I extends GqlTypeFields, ...infer Rest extends Array<GqlTypeFields>]
    ? MergeFields<A, MergeAllFields<I, Rest>>
    : A

export interface GqlType<Self, Tag extends string, Fields extends Struct.Fields> extends TaggedClass<Self, Tag, Fields> {
  [GqlInterfaceTypeId]: typeof GqlTypeTypeId
  readonly partial: TaggedClass<DeepPartial<Self>, Tag, PartialFields<Fields>>
}

export interface GqlInterface<Self, Tag extends string, Fields extends Struct.Fields> extends TaggedClass<Self, Tag, Fields> {
  [GqlInterfaceTypeId]: typeof GqlInterfaceTypeId
  readonly partial: TaggedClass<DeepPartial<Self>, Tag, PartialFields<Fields>>
}

export type AnyGqlType = GqlType<any, any, any>
export type AnyGqlInterface = GqlInterface<any, any, any>

const convertPropertyToOptional = (schema: Schema.PropertySignature.All) => {
  if (schema.ast._tag === `PropertySignatureDeclaration`) {
    return makePropertySignature(new PropertySignatureDeclaration(maybeConvertTuple(schema.ast.type), true, schema.ast.isReadonly, {}, undefined))
  }
  const { from, to } = schema.ast

  return makePropertySignature(
    new PropertySignatureTransformation(
      new PropertySignatureDeclaration(maybeConvertTuple(from.type), true, from.isReadonly, {}, undefined),
      new PropertySignatureDeclaration(maybeConvertTuple(to.type), true, to.isReadonly, {}, undefined),
      schema.ast.decode,
      schema.ast.encode,
    )
  )
}

const getPartialASTAnnotation = (ast: AST.AST) => {
  const a = ast._tag === `Transformation`
    ? ast.to._tag === `Declaration`
      ? AST.getAnnotation<AST.AST>(ast.to, PartialAST)
      : AST.getAnnotation<AST.AST>(ast, PartialAST)
    : AST.getAnnotation<AST.AST>(ast, PartialAST)

  console.log(a)

  return a;
}

const maybeConvertTuple = (ast: AST.AST): AST.AST => {
  if (ast._tag === `TupleType`) {
    return new AST.TupleType(
      ast.elements.map((ast) => {
        return getPartialASTAnnotation(ast.type)
          .pipe(Option.map(a => new OptionalType(a, ast.isOptional, ast.annotations)))
          .pipe(Option.getOrElse(() => ast)
        )
      }),
      ast.rest.map(ast => {
        console.log(ast)
        return getPartialASTAnnotation(ast.type)
          .pipe(Option.map(a => new type(a)))
          .pipe(Option.getOrElse(() => ast)
        )
      }),
      ast.isReadonly,
      ast.annotations
    )
  }
  return ast
}

export const GqlType = <Self = never>() =>
  <Tag extends string, Fields extends GqlTypeFields, InterfaceFields extends Array<GqlTypeFields>>(
    tag: Tag, 
    fieldsOr: Fields,
    interfaces?: { [key in keyof InterfaceFields]: GqlInterface<any, any, InterfaceFields[key] extends GqlTypeFields ? InterfaceFields[key] : {}> },
    annotations?: Annotations.Schema<Self>
  ): [Self] extends [never] ? MissingSelfGeneric<"TaggedClass", `"Tag", `>
    : GqlType<Self, Tag, MergeAllFields<{ readonly _tag: tag<Tag> } & Fields, InterfaceFields>> =>
  {

    let fieldsStruct: GqlTypeFields = { ...fieldsOr }

    ;(interfaces ?? []).forEach((i) => {
      fieldsStruct = {
        ...fieldsStruct,
        ...R.filter(i.fields, (_, key) => key !== `_tag`),
      }
    })
    
    const partialFieldsStruct = R.map(fieldsStruct, (schema, key): AnyGqlType | Schema.Schema.All | Schema.PropertySignature.All => {
      if (`partial` in schema) {
        return schema.partial
      }
      return isSchema(schema)
        ? optional(Schema.make(maybeConvertTuple(schema.ast)))
        : isPropertySignature(schema)
          ? convertPropertyToOptional(schema)
          : Schema.make(schema.ast);
    })

    const PartialBaseClass = (TaggedClass<GqlPartialType>(tag)(tag, partialFieldsStruct, annotations as any)) as new (...args: any[]) => any

    class GqlPartialType extends PartialBaseClass {
    }


    const anno = {
      ...annotations, 
      [ExtendsInterface]: interfaces?.map((i) => i.ast), 
      [GqlTypeTypeId]: GqlInterfaceTypeId,
      [PartialAST]: Schema.Struct(partialFieldsStruct).ast
    }

    const BaseClass = (TaggedClass<Self>(tag)(tag, fieldsStruct, anno)) as new (...args: any[]) => any

    return class GqlType extends BaseClass {
      static readonly partial = GqlPartialType
    } as any
  }

export const GqlInterface = <Self = never>() =>
  <Tag extends string, Fields extends GqlTypeFields>(
    tag: Tag, 
    fieldsOr: Fields,
    annotations?: Annotations.Schema<Self>
  ): [Self] extends [never] 
      ? MissingSelfGeneric<"TaggedClass", `"Tag", `>
      : GqlInterface<Self, Tag, { readonly _tag: tag<Tag> } & Fields> => {
        return TaggedClass<Self>()(tag, fieldsOr, { ...annotations, [GqlInterfaceTypeId]: GqlInterfaceTypeId }) as any
      }