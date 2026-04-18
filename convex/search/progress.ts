import { v } from 'convex/values'
import { internalMutation, mutation, query } from '../_generated/server'
import { searchProgressStageValidator } from '../shared/validators'

/**
 * Creates a progress record for a new search. Called by the frontend before
 * firing the search action so it can subscribe to real-time stage updates.
 */
export const initSearch = mutation({
  args: { prompt: v.string() },
  /**
   * @param ctx - Mutation context used to insert the initial `searchProgress`
   * document.
   * @param args - Payload for a newly submitted search.
   * @param args.prompt - The raw prompt text shown back to the user in the
   * loading UI. The value is stored as submitted and is not trimmed here.
   * @returns The id of the created `searchProgress` document.
   */
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
  /**
   * @param ctx - Mutation context used to patch the existing progress record.
   * @param args - Incremental progress update payload from internal search
   * workflows.
   * @param args.progressId - The `searchProgress` document to update.
   * @param args.stage - The next lifecycle stage to show in the loading UI.
   * @param args.searchId - Optional saved search id. This is usually attached
   * once the search run has been persisted successfully.
   * @param args.error - Optional failure message to persist when the stage moves
   * to `failed`.
   * @returns Nothing. The mutation updates the existing progress record in
   * place.
   */
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
  /**
   * @param ctx - Query context used to read the current progress document.
   * @param args - Lookup payload for a single progress record.
   * @param args.progressId - The id returned by `initSearch`. The query returns
   * `null` if the record no longer exists.
   * @returns The current `searchProgress` document or `null` when the id is
   * missing.
   */
  handler: async (ctx, args) => {
    return await ctx.db.get(args.progressId)
  },
})
