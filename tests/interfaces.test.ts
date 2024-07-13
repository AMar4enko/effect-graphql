import { AST, Schema } from '@effect/schema'
import SchemaBuilder, { ObjectRef } from '@pothos/core'
import { pipe } from 'effect'
import { beforeEach, describe, expect, test } from 'vitest'

import { compileExhaustive } from '../src/compiler'
import { exposeFields } from '../src/pothos-schema/expose-fields'
import { getResolvedFields } from '../src/pothos-schema/helpers'
import { asInterface, extendsInterface } from '../src/pothos-schema/interfaces'
import { mutationRequest, queryRequest, resolveMutation, resolveQuery } from '../src/pothos-schema/resolvers'
import { empty } from '../src/schema-builder'
import { GqlOperation } from '../src/types'

test(`does what's promised`, () => {
  const ID = Schema.Struct({
    id: Schema.String,
  }).pipe(
    asInterface(`ID`),
    exposeFields([`id`]),
  )

  const User = Schema.Struct({
    name: Schema.String,
    age: Schema.Number,
  }).pipe(
    Schema.identifier(`User`),
    extendsInterface(ID),
    exposeFields([`name`, `age`]),
  )

  const exposedObject = getResolvedFields(User)
  const exposedInterface = getResolvedFields(ID)

  expect(Object.keys(exposedObject)).toEqual([`name`, `age`])
  expect(Object.keys(exposedInterface)).toEqual([`id`])
})

test(`resolvers`, () => {
  const User = Schema.Struct({
    name: Schema.String,
    age: Schema.Number,
  }).pipe(
    Schema.identifier(`User`),
    exposeFields([`name`, `age`]),
  )

  class GetUsersRequest extends GqlOperation<GetUsersRequest>()(
    `getUsers`,
    Schema.Never,
    User,
    {
    },
  ) {}

  class UpdateUserRequest extends GqlOperation<UpdateUserRequest>()(
    `updateUser`,
    Schema.Never,
    User,
    {
      id: Schema.String,
      name: Schema.String,
    },
  ) {}

  const s = pipe(
    empty(),
    queryRequest(GetUsersRequest),
    mutationRequest(UpdateUserRequest),
    resolveQuery(`getUsers`, 1 as any),
    resolveMutation(`updateUser`, 1 as any),
  )

  expect(s).toMatchObject({
    query: {
      getUsers: GetUsersRequest,
    },
    mutation: {
      updateUser: UpdateUserRequest,
    },
  })
})

describe(`getTypeForAST`, () => {
  let objects: Map<AST.AST, ObjectRef<any, any>>
  let scalars: Map<AST.AST, string>
  let interfaces: Map<AST.AST, ObjectRef<any, any>>

  beforeEach(() => {
    objects = new Map()
    scalars = new Map()
    interfaces = new Map()
  })
  // test(`Primitive types`, () => {
  //   const getType = getTypeForAST(objects, scalars, interfaces)
  //   expect(getType(Schema.string.ast)).toEqual(`String`)
  //   const int = Schema.number.pipe(Schema.int())
  //   expect(getType(int.ast)).toEqual(`Int`)
  //   expect(getType(Schema.number.ast)).toEqual(`Float`)
  //   expect(getType(Schema.boolean.ast)).toEqual(`Boolean`)
  // })

  // test(`Scalars from transforms`, () => {
  //   const getType = getTypeForAST(objects, scalars, interfaces)
  //   expect(getType(Schema.Duration.ast)).toEqual(`Duration`)
  //   expect(scalars.get(Schema.Duration.ast)).toEqual(`Duration`)

  //   const optionJson = Schema.parseJson(
  //     Schema.option(Schema.NumberFromString),
  //   ).pipe(
  //     Schema.annotations({ identifier: `OptionNumber` }),
  //   )

  //   expect(
  //     getType(
  //       optionJson.ast,
  //     )).toEqual(`OptionNumber`)
  // })
})

describe.only(`compiler`, () => {
  test(`basic test`, () => {
    const User = Schema.Struct({
      name: Schema.String,
      createdAt: Schema.DateFromSelf,
    }).annotations({
      identifier: `User`,
    })

    class GetUserRequest extends GqlOperation<GetUserRequest>()(
      `GetUserRequest`,
      Schema.Never,
      User,
      {
        id: Schema.String,
      },
    ) {}

    const sb = pipe(
      empty(),
      queryRequest(GetUserRequest),
      s => (s.type.push(User), s),
      compileExhaustive(new SchemaBuilder({})),
    )
    const s = sb.toSchema()
  })
})
