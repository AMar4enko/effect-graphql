import { compact } from 'effect/Chunk'
import { cons } from 'effect/List'
import { AST, Schema } from '@effect/schema'
import { TypeAnnotationId } from '@effect/schema/AST'
import { IntTypeId, TaggedRequest } from '@effect/schema/Schema'
import SchemaBuilder, { MutationFieldBuilder, ObjectFieldBuilder, ObjectFieldsShape, ObjectRef, QueryFieldBuilder, RootFieldBuilder } from '@pothos/core'
import { Effect, Match, Option, pipe, ReadonlyRecord } from 'effect'

import { EmptyPothosSchema, GqlOperation, TaggedRequestNewable } from './types'

export const registerFieldFromAST = (
  objects: Map<AST.AST, ObjectRef<any, any>>,
  scalars: Map<AST.AST, string>,
  interfaces: Map<AST.AST, ObjectRef<any, any>>,
) => (ast: AST.AST) => {
  const compilerThrow = (ast: AST.AST) => {
    throw new Error(`Unsupported AST type: ${ast._tag}`)
  }

  const compiler = AST.getCompiler<any>({
    NumberKeyword: () => ({ type: `Float` }),
    BooleanKeyword: () => ({ type: `Boolean` }),
    StringKeyword: () => ({ type: `String` }),
    Refinement: (ast) => {
      if (AST.isNumberKeyword(ast.from)) {
        const typeAnnotation = AST.getAnnotation(ast, TypeAnnotationId)
        if (Option.isSome(typeAnnotation) && typeAnnotation.value === IntTypeId) {
          return { type: `Int` }
        }
      }

      const type = scalars.get(ast) ?? (() => {
        const scalarId = Option.getOrElse(() => `Scalar${scalars.size}`)(AST.getIdentifierAnnotation(ast.from))
        scalars.set(ast, scalarId)
        return scalarId
      })()

      return { type }
    },
    Transformation: (ast) => {
      if (AST.isFinalTransformation(ast.transformation) || AST.isComposeTransformation(ast.transformation)) {
        const type = scalars.get(ast) ?? (() => {
          const scalarId = Option.getOrElse(() => `Scalar${scalars.size}`)(AST.getIdentifierAnnotation(ast))
          scalars.set(ast, scalarId)
          return scalarId
        })()

        return { type }
      }

      return compilerThrow(ast)
    },
    TypeLiteral: (ast) => {
      const type = objects.get(ast) ?? (() => {
        const objRef = new ObjectRef<any, any>(Option.getOrThrowWith(AST.getIdentifierAnnotation(ast), () => new Error(`Object must have an identifier`)))
        objects.set(ast, objRef)
        return objRef
      })()

      return { type }
    },
    Declaration: (ast) => {
      const type = scalars.get(ast) ?? (() => {
        const scalarId = Option.getOrElse(() => `Scalar${scalars.size}`)(AST.getIdentifierAnnotation(ast))
        scalars.set(ast, scalarId)
        return scalarId
      })()

      return { type }
    },
    AnyKeyword: compilerThrow,
    BigIntKeyword: compilerThrow,
    Enums: compilerThrow,
    Literal: compilerThrow,
    NeverKeyword: compilerThrow,
    ObjectKeyword: compilerThrow,
    Suspend: compilerThrow,
    SymbolKeyword: compilerThrow,
    TemplateLiteral: compilerThrow,
    TupleType: (ast, compile) => {
      return {
        type: [compile(ast.rest[0]).type],
      }
    },
    UndefinedKeyword: compilerThrow,
    Union: compilerThrow,
    UniqueSymbol: compilerThrow,
    UnknownKeyword: compilerThrow,
    VoidKeyword: compilerThrow,
  })

  return compiler(ast)
}

export const compileExhaustive = <S extends EmptyPothosSchema>(b: PothosSchemaTypes.SchemaBuilder<PothosSchemaTypes.ExtendDefaultTypes<{}>>) => (s: S) => {
  const types = [
    ...s.type,
  ]

  const objRefs = new Map<AST.AST, ObjectRef<any, any>>()
  const scalarRefs = new Map<AST.AST, string>()
  const interfaceRefs = new Map<AST.AST, ObjectRef<any, any>>()

  const getFieldDef = registerFieldFromAST(objRefs, scalarRefs, interfaceRefs)

  const getRequestAnnotations = (r: TaggedRequestNewable<any>) => pipe(
    AST.getJSONSchemaAnnotation((r.ast as AST.Transformation).to) as unknown as Option.Option<Record<string, any>>,
    Option.map(({ schema }) => schema),
    Option.bindTo(`jsonSchema`),
    Option.bind(`tag`, ({ jsonSchema }) => Option.fromNullable(jsonSchema.tag as string)),
    Option.bind(`success`, ({ jsonSchema }) => Option.fromNullable(jsonSchema.success as Schema.Schema.Any)),
    Option.bind(`failure`, ({ jsonSchema }) => Option.fromNullable(jsonSchema.failure as Schema.Schema.Any)),
    Option.bind(`fields`, ({ jsonSchema }) => Option.fromNullable(jsonSchema.fields as Schema.Schema.Any)),
    Option.getOrThrowWith(() => new Error(`Request must be created using GqlOperation function`)),
  )

  const traverseAst = (ast: AST.AST, f: Record<PropertyKey, any>) => {
    switch (ast._tag) {
      case `TypeLiteral`:
        ast.propertySignatures.forEach((prop) => {
          const fieldDef = getFieldDef(prop.type)
          f[prop.name] = (t: any) => t.field(fieldDef)
        })
        return f
      default:
        return f
    }
  }

  const registerObject = (ast: AST.AST) => {
    const id = Option.getOrThrowWith(
      AST.getIdentifierAnnotation(ast),
      () => new Error(`Object must have an identifier`),
    )
    const objRef = new ObjectRef<any, any>(id)
    objRefs.set(ast, objRef)

    const fields = traverseAst(ast, {})

    b.objectType(objRef, {
      fields: t => ReadonlyRecord.map(fields, a => a(t)),
    })
  }

  const registerQuery = (op: TaggedRequestNewable<any>) => {
    const { tag, success, failure, fields } = getRequestAnnotations(op)

    b.queryType({
      fields: t => ({
        [tag]: t.field(getFieldDef(success.ast)),
      }),
    })
  }

  s.type.forEach(s => registerObject(s.ast))
  ReadonlyRecord.values(s.query).forEach(registerQuery)

  scalarRefs.forEach((id, ast) => {
    const s = Schema.make(ast)
    const serialize = Schema.encodeSync(s)
    const deserialize = Schema.decodeSync(s)
    console.log(id, ast)
    b.scalarType(id as any, {
      serialize,
      parseValue: deserialize,
      parseLiteral: node => deserialize(node),
      description: Option.getOrElse(() => ``)(AST.getDescriptionAnnotation(ast)),
    })
    // b.addScalarType(id as any, {
    //   name: id,
    //   serialize,
    //   parseValue: deserialize,
    //   parseLiteral: (node) => deserialize(node),
    //   description: id,
    //   astNode: undefined,
    //   extensionASTNodes: [],

    // })
  })

  return b
}

// const ExposeAnnotationId = Symbol.for(`@effect-pothos/ExposeAnnotationId`)

// const traverseAst = (ast: AST.AST, f: (ast: AST.AST) => void): void => {
//   f(ast)
//   switch (ast._tag) {
//     case `Transformation`:
//       return traverseAst(ast.from, f)
//     case `TypeLiteral`:
//       return ast.indexSignatures.forEach((signature) => traverseAst(signature.type, f))
//   }
// }

// const getTypeGenerator = <A>(s: (new (...args: any[]) => A) & Schema.Schema.Any) => {
//   const { fields, typeName } = Effect.succeed(s.ast)
//     .pipe(
//       Effect.filterOrFail(AST.isTransform),
//       Effect.bindTo(`ast`),
//       Effect.bind(`typeName`, ({ ast }) => AST.getIdentifierAnnotation(ast.to)),
//       Effect.bind(`fields`, ({ ast }) => Effect.succeed(AST.getPropertySignatures(ast.to))),
//       Effect.runSync
//     )

//   return <
//     Types extends Partial<PothosSchemaTypes.UserSchemaTypes>
//   >(builder: PothosSchemaTypes.SchemaBuilder<PothosSchemaTypes.ExtendDefaultTypes<Types>>, s: AnyPothosSchema) => Effect.gen(function* ($) {
//     const runtime = yield* $(Effect.runtime())

//     fields.forEach((propSignature) => {
//       if (Option.isNone(AST.getAnnotation(propSignature, ExposeAnnotationId))) {
//         return;
//       }

//     })
//   })
// }

// class User extends Schema.TaggedClass<User>()(
//   `User`,
//   {
//     name: Schema.string,
//     companies: Schema.array(Schema.struct({ name: Schema.string }))
//   }
// ) {}

// const schemaBuilder = new SchemaBuilder({})

// getTypeGenerator(User)(schemaBuilder, empty())
//   .pipe(
//     Effect.runSync
//   )
