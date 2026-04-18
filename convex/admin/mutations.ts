import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireAdminUser } from '../auth'
import { isAvailableAiModelId } from '../shared/model'

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
