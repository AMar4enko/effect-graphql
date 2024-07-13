import * as Option from 'effect/Option'
import { Simplify } from 'effect/Types'
import { AST, Schema } from '@effect/schema'

import { FieldResolvers, GqlInterface, GqlInterfaceName } from './annotation'
import { getInterfaceFields } from './interface'
import { exposeKey } from './misc'
import { AnyClass } from './types'

type SchemaClassFields<A extends AnyClass> =
  A extends Schema.Class<any, infer Fields extends Schema.Struct.Fields, any, any, any, any, any>
    ? Schema.Struct.Type<Fields>
    : never

export type ExtendClass<A extends AnyClass, B extends Schema.Struct<any>> =
  [A, B] extends [
    Schema.Class<
      infer Self,
      infer ClassFields extends Schema.Struct.Fields, infer I, infer R, infer C, infer Inherited, infer Proto
    >,
    Schema.Struct<infer StructFields>,
  ]
    ? Simplify<ClassFields & StructFields> extends Schema.Struct.Fields
      ? Schema.Class<
          Self,
          Simplify<ClassFields & StructFields>,
          I & Schema.Struct.Encoded<StructFields>,
          R | Schema.Struct.Context<StructFields>,
          Simplify<C & Schema.Struct.Type<StructFields>>
          , Inherited, Proto>
      : A
    : A

export const extendsInterface = <
  Self extends Schema.TaggedClass<any, any, any>,
  Struct extends Schema.Struct<any>,
>(i: Struct) =>
    (Class: Self): ExtendClass<Self, Struct> => {
      Option.getOrThrowWith(
        AST.getAnnotation(i.ast, GqlInterfaceName),
        () => `Schema ${i} must be annotated with asInterface annotation`,
      )

      if (Class.ast._tag !== `Transformation`) {
        throw new Error(`Schema ${Class} AST doesn't appear to be Class`)
      }

      const existing = Option.getOrElse(() => [])(AST.getAnnotation<any[]>(Class.ast.to, GqlInterface))

      return Class.extend<Self>(Class.identifier)(
        i.fields,
        {
          [GqlInterface]: [...existing, i.ast],
        },
      ) as any
    }

export const exposeFields = <
  Self extends Schema.TaggedClass<any, any, any>,
  Field extends keyof Omit<SchemaClassFields<Self>, '_tag'>,
>(fields: Field[]) =>
    (Class: Self): Self => {
      if (Class.ast._tag !== `Transformation`) {
        throw new Error(`Schema ${Class} AST doesn't appear to be Class`)
      }

      const interfaceFields = new Map(getInterfaceFields(Class).map(field => [field.name, field]))

      const fieldResolvers = Option.getOrElse(() => {})(AST.getAnnotation<Record<string, any>>(Class.ast.to, FieldResolvers))

      const objectFields = fields.filter(field => !interfaceFields.has(field))

      return Class.extend<Self>(Class.identifier)(
        {},
        {
          [FieldResolvers]: {
            ...fieldResolvers,
            ...Object.fromEntries(
              objectFields.map(field => [field, exposeKey]),
            ),
          },
        },
      ) as any
    }
