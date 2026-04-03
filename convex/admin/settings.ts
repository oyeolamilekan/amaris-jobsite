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
