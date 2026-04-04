import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import authConfig from './auth.config'
import { components } from './_generated/api'
import { query } from './_generated/server'
import type { GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'
import type { Doc as BetterAuthDoc } from './betterAuth/_generated/dataModel'
import type { BetterAuthOptions } from 'better-auth'

const siteUrl = process.env.SITE_URL!

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth)
const DEFAULT_USER_ROLE = 'standard' as const

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            if ('role' in user && typeof user.role === 'string' && user.role.length > 0) {
              return
            }

            return {
              data: {
                ...user,
                role: DEFAULT_USER_ROLE,
              },
            }
          },
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx))
}

export async function getCurrentUserOrNull(ctx: GenericCtx<DataModel>) {
  const user = await authComponent.safeGetAuthUser(ctx)
  return (user as BetterAuthDoc<'user'> | undefined) ?? null
}

export async function requireAuthenticatedUser(ctx: GenericCtx<DataModel>) {
  const user = await getCurrentUserOrNull(ctx)

  if (user === null) {
    throw new Error('Not authenticated')
  }

  return user
}

export async function requireAdminUser(ctx: GenericCtx<DataModel>) {
  const user = await requireAuthenticatedUser(ctx)

  if (user.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  return user
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUserOrNull(ctx)
  },
})
