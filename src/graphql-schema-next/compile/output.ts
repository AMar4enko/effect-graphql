import { AST, Schema } from '@effect/schema'
import { PropertySignature } from '@effect/schema/AST'
import { Array as A, Effect, FiberRef, Match, Option, Record as R, Runtime, Array, Record } from 'effect'
import { GraphQLFieldConfig, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLType, GraphQLUnionType } from 'graphql/type'

import { DeprecationReason, SurrogateAnnotationId } from '../annotation'
import * as Ctx from './context'

import { compileInputFields } from './input'
import { cache, compileEnum, compileScalar, makeResolver, omitTag } from './misc'
import { getInterfaces } from '../interface'
import * as GraphQL from '../schema'
import { getIdentifierAnnotation } from '../misc'
import { GqlInterfaceTypeId, GqlTypeTypeId } from '../entity'

const isProp = FiberRef.unsafeMake(false)

const compileTuple = (ast: AST.TupleType) => {
  return A.head(ast.rest).pipe(
    Effect.flatMap(el => compileOutputType(el.type)),
    Effect.map(inputType => new GraphQLList(inputType)),
    Effect.catchAll((e) => Effect.fail(new Error(`Cannot compile input tuple type ${ast}: ${e}`))),
  )
}

const nonNullable = <A extends GraphQLType>(type: A) => 
  type instanceof GraphQLNonNull
    ? type
    : new GraphQLNonNull(type)

const compileUnion = Match.type<AST.AST>().pipe(
  Match.tag(`Union`, (ast) => {
    /** Optional types represented as union with undefined */
    const compiledTypes = ast.types.filter((ast) => ast !== AST.undefinedKeyword).map(compileOutputType)
    const optional = ast.types.includes(AST.undefinedKeyword)

    /** 
     * If there was only one type in the union, 
     * most likely it was union with undefined which indicates optional
     */
    return Effect.runtime<GraphQL.Schema<GraphQL.Schema.AnyDefinition>>().pipe(
      Effect.map(Runtime.runSync),
      Effect.map((runSync) => {
        if (compiledTypes.length === 1) {
          return {
            optional,
            type: compiledTypes[0].pipe(runSync)
          }
        }

        const types = Effect.all(compiledTypes)
          .pipe(
            Effect.map(Array.filter((type) => type instanceof GraphQLObjectType)),
            runSync
          )

        return {
          optional,
          type: new GraphQLUnionType({
            name: types.map((t) => t.name).join(`_`),
            types,
            resolveType: (obj) => {
              return obj._tag
            }
          })
        }


      })
    )
    
  }),
  Match.orElse(() => Effect.fromNullable(null))
)

const compileTupleEnum = Match.type<AST.AST>().pipe(
  Match.tag(`TupleType`, ast => compileTuple(ast)),
  Match.tag(`Enums`, ast => compileEnum(ast).pipe(cache(ast)))
)

const compileOutputProperty = Match.type<AST.AST | Schema.PropertySignature.AST>().pipe(
  Match.tag(`PropertySignatureDeclaration`, (ast) => {
    const typeAst = ast.isOptional ? (ast.type as AST.Union).types[0] : ast.type
    const defaultValue = AST.getDefaultAnnotation(ast).pipe(Option.getOrUndefined)
    return compileOutputType(typeAst).pipe(
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

    return compileOutputType(ast).pipe(
      Effect.map(type => ({
        type: nonNullable(type),
        defaultValue,
        description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
        deprecationReason: AST.getAnnotation<string>(ast, DeprecationReason).pipe(Option.getOrUndefined),
      })),
    )
  }),
)



const compileFields = (ast: AST.AST, props: PropertySignature[]) => Effect.gen(function* () {
  const source = yield* Ctx.Schema

  const identifier = getIdentifierAnnotation(ast).pipe(Option.getOrNull)

  return yield* Effect.all(
    R.fromEntries(
      props.map(value => [
        value.name as string,
        Effect.gen(function* () {
          const fieldConfig: GraphQLFieldConfig<any, any, any> = {
            ...(yield* compileOutputProperty(value.type)),
          }

          if (identifier) {
            yield* Record.get([identifier, value.name as string].join(`.`))(source.definition.fieldQuery).pipe(
              Effect.andThen((RequestNewable: GraphQL.TaggedRequestNewable<Schema.TaggedRequest.Any>) => 
                Effect.all({
                  resolve: makeResolver(RequestNewable, source.definition.resolver),
                  args: R.isEmptyRecord(RequestNewable.fields) ? Effect.void : compileInputFields(R.filter(RequestNewable.fields, (_, key) => key !== `parent`))
                })
              ),
              Effect.tap((a) => {
                fieldConfig.resolve = a.resolve
                fieldConfig.args = a.args!
              }), 
              Effect.orElseSucceed(() => Effect.void)
            )            
          }
          return fieldConfig
        }),
      ] as const),
    ),
  )
})

const compileTypeLiteral = Match.type<AST.AST>().pipe(
  Match.tag(`TypeLiteral`, ast => Effect.gen(function* () {
    const runSync = Runtime.runSync(yield* Effect.runtime<GraphQL.Schema<GraphQL.Schema.AnyDefinition>>())

    const name = yield* AST.getIdentifierAnnotation(ast).pipe(Effect.orElse(() => Effect.fail(new Error(`TypeLiteral must have identifier annotation`))))

    const fields = FiberRef.set(isProp, true).pipe(
      Effect.zipRight(compileFields(ast, [...ast.propertySignatures]))
    )

    return new GraphQLInterfaceType({
      fields: () => runSync(fields),
      name,
      description: AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined),
    })
  }).pipe(cache(ast))),
)

const compileTransformation = Match.type<AST.AST>().pipe(
  Match.tag(`Transformation`, ast => Effect.gen(function* () {
    const runSync = Runtime.runSync(yield* Effect.runtime<GraphQL.Schema<GraphQL.Schema.AnyDefinition>>())

    const isType = AST.getAnnotation(ast.to, GqlTypeTypeId).pipe(Option.isSome)
    const isInterface = AST.getAnnotation(ast.to, GqlInterfaceTypeId).pipe(Option.isSome)

    if (!isType && !isInterface) {
      return yield* Effect.fail(new Error(`Transformation expected to be either GqlType or GqlInterface`))
    }

    const name = yield* AST.getIdentifierAnnotation(ast.to).pipe(
      Effect.orElse(() => Effect.fail(new Error(`Transformation ${ast} must have identifier annotation`))),
    )

    const surrogate = yield* AST.getAnnotation<AST.TypeLiteral>(ast, SurrogateAnnotationId).pipe(
      Effect.orElse(() => Effect.fail(new Error(`Only TaggedClass Transforms are supported`))),
    )


    const extendsInterfaces = getInterfaces(ast)

    const interfaces = () => {
      return Effect.all(extendsInterfaces.map(compileOutputType)).pipe(
        Effect.map((types) => types.filter((t) => t instanceof GraphQLInterfaceType)),
        runSync
      )
    }

    const fieldsToBeCompiled = omitTag([...surrogate.propertySignatures])

    const compileFieldsEffect = FiberRef.set(isProp, true).pipe(
      Effect.zipRight(compileFields(ast, omitTag([...fieldsToBeCompiled])))
    )

    const fields = () => runSync(compileFieldsEffect)
    const description = AST.getDescriptionAnnotation(ast).pipe(Option.getOrUndefined)


    if (isInterface) {
      return new GraphQLInterfaceType({
        fields,
        interfaces,
        resolveType: (obj) => obj._tag,
        name,
        description,
      })
    }

    return new GraphQLObjectType({
      fields,
      interfaces,
      name,
      description,
    })
  }).pipe(cache(ast))),
)

export const compileOutputType = (ast: AST.AST): Effect.Effect<GraphQLOutputType, Error, GraphQL.Schema<GraphQL.Schema.AnyDefinition>> => Effect.gen(function* () {
  const prop = yield* FiberRef.get(isProp)

  const compile = compileUnion(ast).pipe(
    Effect.map(({ optional, type }) => {
      return optional 
        ? type instanceof GraphQLNonNull 
          ? type.ofType 
          : type
        : nonNullable(type)
    }),
    Effect.catchTag(`NoSuchElementException`, () => {
      const compile = compileScalar.pipe(
        Match.orElse(
          compileTupleEnum.pipe(
            Match.orElse(
              compileTransformation.pipe(
                Match.orElse(ast => Effect.fail(new Error(`Could not compile output type for ${ast}`)))
              )
            ),
          ),
        ),
      )
      return compile(ast).pipe(
        Effect.map((type) => 
          prop 
          ? type 
          : type instanceof GraphQLInterfaceType ? type : nonNullable(type)
        )
      )
    })
  )


  return yield* compile
})
