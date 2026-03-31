import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import type { GenericCtx } from '@convex-dev/better-auth/utils'
import type { BetterAuthOptions } from 'better-auth'
import { betterAuth } from 'better-auth'
import { components } from '../_generated/api'
import type { DataModel } from '../_generated/dataModel'
import authConfig from '../auth.config'
import schema from './schema'

// Safe env access that doesn't throw — returns '' when unavailable (module init).
const getEnv = (name: string) =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name] ?? ''

// Better Auth Component
export const authComponent = createClient<DataModel, typeof schema>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (components as any).betterAuth,
  {
    local: { schema },
    verbose: true,
  },
)

// Better Auth Options
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    appName: 'Amaris',
    baseURL: getEnv('SITE_URL'),
    secret: getEnv('BETTER_AUTH_SECRET'),
    database: authComponent.adapter(ctx),
    logger: {
      disabled: false,
    },
    socialProviders: {
      google: {
        clientId: getEnv('GOOGLE_CLIENT_ID'),
        clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
      },
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions
}

// For `auth` CLI schema generation
export const options = createAuthOptions({} as GenericCtx<DataModel>)

// Better Auth Instance
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx))
}
