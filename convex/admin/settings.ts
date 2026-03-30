import { v } from 'convex/values'
import { internalQuery, mutation, query } from '../_generated/server'
import { JOB_SEARCH_MODEL } from '../shared/constants'

/**
 * Well-known AI Gateway model identifiers available for selection.
 */
export const AVAILABLE_AI_MODELS = [
  { id: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'google/gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview', provider: 'Google' },
  { id: 'google/gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro Preview', provider: 'Google' },
  { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'openai/gpt-4.1', label: 'GPT-4.1', provider: 'OpenAI' },
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'OpenAI' },
  { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'anthropic/claude-3.5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'Anthropic' },
] as const

/**
 * Returns the current admin settings, falling back to defaults when no
 * settings document exists yet.
 */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query('adminSettings').first()

    return {
      aiModel: settings?.aiModel ?? JOB_SEARCH_MODEL,
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
      aiModel: settings?.aiModel ?? JOB_SEARCH_MODEL,
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
