import { Schema } from '@effect/schema'

const IDBrand = Schema.brand(`GqlID`)
const FloatBrand = Schema.brand(`GqlFloat`)

export const ID = Schema.String.pipe(IDBrand)
export const Float = Schema.Number.pipe(FloatBrand)
