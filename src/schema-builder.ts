import { EmptyPothosSchema, PothosSchema } from './types'

export const empty = (): EmptyPothosSchema => ({
  type: [],
  query: {},
  mutation: {},
  subscription: {},
})
