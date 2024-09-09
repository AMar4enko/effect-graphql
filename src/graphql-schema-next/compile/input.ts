import { AST, Schema } from '@effect/schema'
import { Array as A, Effect, Match, Option, Record as R } from 'effect'
import { GraphQLInputFieldConfig, GraphQLInputObjectType, GraphQLInputType, GraphQLList, GraphQLNonNull } from 'graphql'

import { DeprecationReason } from '../annotation'

import { cache, compileEnum, compileScalar, getSchemaCache } from './misc'

const compileTuple = (ast: AST.TupleType) =>
  A.head(ast.elements).pipe(
    Effect.flatMap(el => compileInputType(el.type)),
    Effect.map(inputType => new GraphQLList(inputType)),
    Effect.catchAll(() => Effect.fail(new Error(`Cannot compile input tuple type ${ast}`))),
  )

const compileUnionTupleEnum = Match.type<AST.AST>().pipe(
  Match.tag(`TupleType`, ast => compileTuple(ast)),
  Match.tag(`Enums`, ast => compileEnum(ast)),
  Match.tag(`Union`, ast => {
    if (ast.types.length === 2 && ast.types.includes(AST.undefinedKeyword)) {
      return compileInputType(ast.types.filter((ast) => ast !== AST.undefinedKeyword)[0])
    }
    return Effect.fail(new Error(`Unions are not supported ${ast}`))
  })
)

const compileTypeLiteral = Match.type<AST.AST>().pipe(
  Match.tag(`TypeLiteral`, ast => Effect.gen(function* () {
    const cache = yield* getSchemaCache
    const name = yield* AST.getIdentifierAnnotation(ast)
      .pipe(
        Effect.orElse(() => Effect.fail(new Error(`TypeLiteral must have identifier annotation`)))
      )

    const compileFields = Effect.suspend(() => {
      const defs = ast.propertySignatures.map((prop) => {
        return compileInputType(prop.type).pipe(
          Effect.map((type) => {
            return [
              prop.name as string,
              {
                type: prop.isOptional ? type : new GraphQLNonNull(type),
                defaultValue: AST.getDefaultAnnotation(prop).pipe(Option.getOrUndefined),
                description: AST.getDescriptionAnnotation(prop).pipe(Option.getOrUndefined),
                deprecationReason: AST.getAnnotation<string>(prop, DeprecationReason).pipe(Option.getOrUndefined),
              } satisfies GraphQLInputFieldConfig,
            ] as const
          }),
        )
      })
      return Effect.all(defs).pipe(Effect.map(R.fromEntries))
    })

    const fields = yield* compileFields

    const input = new GraphQLInputObjectType({
      fields,
      name,
      description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
    })
    return input
  }).pipe(cache(ast))),
)

export const compileInputType = (ast: AST.AST): Effect.Effect<GraphQLInputType, Error> => Effect.gen(function* () {
  const compiler = compileScalar.pipe(
    Match.orElse(
      compileUnionTupleEnum.pipe(
        Match.orElse( 
          compileTypeLiteral.pipe(
            Match.orElse(ast => Effect.fail(new Error(`Could not compile input type for ${ast}`)))
          )
        )
      )        
    )
  )

  return yield* compiler(ast).pipe(cache(ast))
})

const compileInputProperty = Match.type<AST.AST | Schema.PropertySignature.AST>().pipe(
  Match.tag(`PropertySignatureDeclaration`, (ast) => {
    const typeAst = ast.isOptional ? (ast.type as AST.Union).types[0] : ast.type
    const defaultValue = AST.getDefaultAnnotation(ast).pipe(Option.getOrUndefined)
    return compileInputType(typeAst).pipe(
      Effect.map(type => ({
        type: ast.isOptional
          ? type
          : new GraphQLNonNull(type),
        defaultValue,
        description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
        deprecationReason: AST.getAnnotation(ast, DeprecationReason).pipe(
          Option.map(a => a as string),
          Option.getOrUndefined,
        ),
      })),
    )
  }),
  Match.tag(`PropertySignatureTransformation`, () => Effect.fail(new Error(`Cannot compile transformation property signature`))),
  Match.orElse((ast) => {
    const defaultValue = AST.getDefaultAnnotation(ast).pipe(Option.getOrUndefined)
    return compileInputType(ast).pipe(
      Effect.map(type => ({
        type: new GraphQLNonNull(type),
        defaultValue,
        description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
        deprecationReason: AST.getAnnotation<string>(ast, DeprecationReason).pipe(Option.getOrUndefined),
      })),
    )
  }),
)

export const compileInputFields = (fields: Schema.Struct.Fields) => Effect.gen(function* () {
  const withoutTag = R.filter(fields, (_, key) => key !== `_tag`)

  return yield* Effect.all(
    R.mapEntries(withoutTag, (signature, key) => {
      return [key, compileInputProperty(signature.ast)]
    })
  )
})
