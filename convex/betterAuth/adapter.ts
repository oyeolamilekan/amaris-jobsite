import { createApi } from '@convex-dev/better-auth'
import schema from './schema'

// Minimal options factory for the adapter — only needs schema structure,
// not runtime env vars. Env vars are only needed at request time in auth.ts.
export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, () => ({
  socialProviders: {
    google: {
      clientId: '',
      clientSecret: '',
    },
  },
}))
