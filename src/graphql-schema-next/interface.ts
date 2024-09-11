import { pipe } from 'effect/Function'
import { AST } from '@effect/schema'
import { Option } from 'effect'

import { ExtendsInterface } from './annotation'

export const getInterfaces: (a: AST.AST) => AST.AST[] = (ast: AST.AST): AST.Transformation[] => {
  return pipe(
    AST.getAnnotation<AST.Transformation[]>(ast._tag === `Transformation` ? ast.to : ast, ExtendsInterface),
    Option.getOrElse(() => [] as AST.Transformation[]),
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
// export const getInterfaceFields: {
//   <C extends AnyClass>(c: C): AST.PropertySignature[]
//   <S extends Schema.Schema.Any>(schema: S): AST.PropertySignature[]
// } = (s: Schema.Schema.Any): AST.PropertySignature[] => {
//   return pipe(
//     getInterfaces(s.ast),
//     ast => Arr.flatten(ast.map(AST.getPropertySignatures)),
//   )
// }

// export const exposeFields = <
//   Self extends Schema.Struct<any>,
//   Field extends keyof Self['fields'],
// >(fields: Field[]) =>
//     (s: Self) => {
//       const fieldResolvers = Option.getOrElse(() => {})(AST.getAnnotation<Record<string, any>>(s.ast, FieldResolvers))

//       return s.annotations({
//         [FieldResolvers]: {
//           ...fieldResolvers,
//           ...Object.fromEntries(
//             fields.map(field => [field, exposeKey]),
//           ),
//         },
//       })
//     }
