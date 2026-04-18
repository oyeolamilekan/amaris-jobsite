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

/**
 * Builds the Better Auth configuration used inside the Convex runtime.
 *
 * @param ctx - Better Auth/Convex context used to bind the component adapter to
 * the current request.
 * @returns Better Auth options configured with the Convex adapter, Google
 * OAuth, session settings, and the default-role database hook.
 */
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

/**
 * Creates the Better Auth instance used by the Convex HTTP integration.
 *
 * @param ctx - Better Auth/Convex context used to construct the auth adapter.
 * @returns A configured Better Auth instance for the current request.
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx))
}

/**
 * Resolves the authenticated Better Auth user for the current request.
 *
 * @param ctx - Better Auth/Convex context used to read the auth session and
 * user record.
 * @returns The authenticated user document or `null` when the request is not
 * associated with a signed-in user.
 */
export async function getCurrentUserOrNull(ctx: GenericCtx<DataModel>) {
  const user = await authComponent.safeGetAuthUser(ctx)
  return (user as BetterAuthDoc<'user'> | undefined) ?? null
}

/**
 * Resolves the authenticated user and throws when the request is anonymous.
 *
 * @param ctx - Better Auth/Convex context used to read the auth session and
 * user record.
 * @returns The authenticated user document.
 * @throws Error when no signed-in user is associated with the request.
 */
export async function requireAuthenticatedUser(ctx: GenericCtx<DataModel>) {
  const user = await getCurrentUserOrNull(ctx)

  if (user === null) {
    throw new Error('Not authenticated')
  }

  return user
}

/**
 * Resolves the authenticated user and throws unless that user has the `admin`
 * role.
 *
 * @param ctx - Better Auth/Convex context used to resolve the current user.
 * @returns The authenticated admin user document.
 * @throws Error when the request is anonymous or the user is not an admin.
 */
export async function requireAdminUser(ctx: GenericCtx<DataModel>) {
  const user = await requireAuthenticatedUser(ctx)

  if (user.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  return user
}

export const getCurrentUser = query({
  args: {},
  /**
   * @param ctx - Query context used to read the current auth session through the
   * Better Auth component.
   * @param _args - No input arguments are required for this query.
   * @returns The authenticated user document or `null` when the request is not
   * signed in.
   */
  handler: async (ctx) => {
    return await getCurrentUserOrNull(ctx)
  },
})
