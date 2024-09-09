import { dual, pipe } from 'effect/Function'
import { AST, Schema } from '@effect/schema'
import { Array as Arr, Option } from 'effect'

import { FieldResolvers, GqlInterface, GqlInterfaceName } from './annotation'
import { exposeKey } from './misc'
import { AnyClass } from './types'

export const getInterfaces: (a: AST.AST) => AST.AST[] = (ast: AST.AST): AST.AST[] => {
  return pipe(
    AST.getAnnotation<AST.AST[]>(ast._tag === `Transformation` ? ast.to : ast, GqlInterface),
    Option.getOrElse(() => []),
  )
}

/**
 * Extracts all field property signatures that belong to interfaces not object itself
 *
 * @example
 *
 * const Identifiable = Schema.struct({
 *  id: Schema.string,
 * }).pipe(
 *   asInterface(`Identifiable`),
 * )
 *
 * const Timestamps = Schema.struct({
 *   updated: Schema.DateFromSelf,
 * }).pipe(
 *   asInterface(`Timestamps`),
 * )
 *
 * const User = Schema.struct({
 *  name: Schema.string,
 * }).pipe(
 *   extendsInterface(Identifiable),
 *   extendsInterface(Timestamps),
 * )
 *
 * getInterfaceFields(User) // returns property signatures of `id` and `updated` fields
 */
export const getInterfaceFields: {
  <C extends AnyClass>(c: C): AST.PropertySignature[]
  <S extends Schema.Schema.Any>(schema: S): AST.PropertySignature[]
} = (s: Schema.Schema.Any): AST.PropertySignature[] => {
  return pipe(
    getInterfaces(s.ast),
    ast => Arr.flatten(ast.map(AST.getPropertySignatures)),
  )
}

export const exposeFields = <
  Self extends Schema.Struct<any>,
  Field extends keyof Self['fields'],
>(fields: Field[]) =>
    (s: Self) => {
      const fieldResolvers = Option.getOrElse(() => {})(AST.getAnnotation<Record<string, any>>(s.ast, FieldResolvers))

      return s.annotations({
        [FieldResolvers]: {
          ...fieldResolvers,
          ...Object.fromEntries(
            fields.map(field => [field, exposeKey]),
          ),
        },
      })
    }
