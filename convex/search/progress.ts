import { v } from 'convex/values'
import { internalMutation, mutation, query } from '../_generated/server'
import { searchProgressStageValidator } from '../shared/validators'

/**
 * Creates a progress record for a new search. Called by the frontend before
 * firing the search action so it can subscribe to real-time stage updates.
 */
export const initSearch = mutation({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert('searchProgress', {
      prompt: args.prompt,
      stage: 'analyzing',
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Advances the progress record to the next pipeline stage. Called internally
 * by the search action at each step.
 */
export const updateSearchProgress = internalMutation({
  args: {
    progressId: v.id('searchProgress'),
    stage: searchProgressStageValidator,
    searchId: v.optional(v.id('searchRuns')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.progressId, {
      stage: args.stage,
      searchId: args.searchId,
      error: args.error,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Reads the current progress for a search. The frontend subscribes to this
 * query for real-time loading-screen updates.
 */
export const getSearchProgress = query({
  args: { progressId: v.id('searchProgress') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.progressId)
  },
})
