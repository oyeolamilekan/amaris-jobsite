import { v } from 'convex/values'
import { internalQuery, mutation, query } from '../_generated/server'
import { requireAdminUser } from '../auth'
import { JOB_SEARCH_MODEL } from '../shared/constants'
import { isAvailableAiModelId, resolveAiModelId } from '../shared/model'

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
      aiModel: resolveAiModelId(settings?.aiModel ?? JOB_SEARCH_MODEL),
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
      aiModel: resolveAiModelId(settings?.aiModel ?? JOB_SEARCH_MODEL),
    }
  },
})

/**
 * Updates the AI model used by the search pipeline. Upserts the singleton
 * settings document.
 */
export const updateAiModel = mutation({
  args: {
    aiModel: v.string(),
  },
  /**
   * @param ctx - Mutation context used to enforce admin access and upsert the
   * singleton `adminSettings` document.
   * @param args - Requested AI model update payload.
   * @param args.aiModel - The model id to persist. The value must match one of
   * the supported model ids exposed by `AVAILABLE_AI_MODELS`; unsupported ids
   * throw.
   * @returns Nothing. The mutation either patches the existing settings
   * document or inserts it if it does not exist yet.
   */
  handler: async (ctx, args) => {
    await requireAdminUser(ctx)

    if (!isAvailableAiModelId(args.aiModel)) {
      throw new Error('Unsupported AI model.')
    }

    const existing = await ctx.db.query('adminSettings').first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        aiModel: args.aiModel,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('adminSettings', {
        aiModel: args.aiModel,
        updatedAt: Date.now(),
      })
    }
  },
})
