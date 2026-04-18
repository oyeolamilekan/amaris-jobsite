import { internalQuery, query } from '../_generated/server'
import { requireAdminUser } from '../auth'
import { resolveAdminSettingsAiModel } from './functions'

/**
 * Returns the current admin settings, falling back to defaults when no
 * settings document exists yet.
 */
export const getSettings = query({
  args: {},
  /**
   * @param ctx - Query context used to enforce admin access and read the
   * singleton `adminSettings` document.
   * @param _args - No input arguments are required for this query.
   * @returns The current AI model id plus the last update timestamp. When no
   * settings document exists yet, the query falls back to the default model and
   * returns `updatedAt: null`.
   */
  handler: async (ctx) => {
    await requireAdminUser(ctx)
    const settings = await ctx.db.query('adminSettings').first()

    return {
      aiModel: resolveAdminSettingsAiModel(settings?.aiModel),
      updatedAt: settings?.updatedAt ?? null,
    }
  },
})

/**
 * Internal version of getSettings for use by actions via ctx.runQuery.
 */
export const getSettingsInternal = internalQuery({
  args: {},
  /**
   * @param ctx - Query context used by internal actions that need the currently
   * selected AI model without enforcing admin-only access.
   * @param _args - No input arguments are required for this query.
   * @returns The resolved AI model id, falling back to the default model when no
   * settings document exists yet.
   */
  handler: async (ctx) => {
    const settings = await ctx.db.query('adminSettings').first()

    return {
      aiModel: resolveAdminSettingsAiModel(settings?.aiModel),
    }
  },
})
