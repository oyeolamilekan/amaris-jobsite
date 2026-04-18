import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import {
  linkedinPeopleSearchStatusValidator,
  savedLinkedInPersonValidator,
} from '../shared/validators'

/**
 * Updates the status of an in-progress LinkedIn people search so the UI can
 * show real-time progress stages.
 */
export const updateLinkedInPeopleSearchStatus = internalMutation({
  args: {
    searchId: v.id('linkedinPeopleSearches'),
    status: linkedinPeopleSearchStatusValidator,
    summary: v.optional(v.string()),
  },
  /**
   * @param ctx - Mutation context used to patch an in-progress
   * `linkedinPeopleSearches` document.
   * @param args - Incremental status update payload for a saved LinkedIn search.
   * @param args.searchId - The saved LinkedIn search document to update.
   * @param args.status - The next lifecycle stage to persist, such as
   * `searching`, `enriching`, `completed`, or `no_results`.
   * @param args.summary - Optional replacement summary. When omitted, the
   * previous summary text is left unchanged.
   * @returns Nothing. Missing search ids are treated as a no-op.
   */
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.searchId)
    if (doc === null) return

    await ctx.db.patch(args.searchId, {
      status: args.status,
      ...(args.summary !== undefined ? { summary: args.summary } : {}),
      updatedAt: Date.now(),
    })
  },
})

/**
 * Inserts or replaces the saved LinkedIn people search document for a job
 * result.
 */
export const saveLinkedInPeopleSearch = internalMutation({
  args: {
    jobResultId: v.id('jobResults'),
    company: v.string(),
    jobTitle: v.string(),
    status: linkedinPeopleSearchStatusValidator,
    query: v.string(),
    summary: v.string(),
    people: v.array(savedLinkedInPersonValidator),
  },
  /**
   * @param ctx - Mutation context used to insert or replace the saved document.
   * @param args - The normalized LinkedIn people search payload to persist.
   * @param args.jobResultId - The saved job this people search belongs to.
   * @param args.company - Company name used for both display and query context.
   * @param args.jobTitle - Source job title shown alongside the people search.
   * @param args.status - Final or intermediate lifecycle state for the saved
   * people search.
   * @param args.query - The LinkedIn-focused Tavily query string that produced
   * the result set.
   * @param args.summary - Human-readable summary shown in the UI.
   * @param args.people - Fully normalized people payload. Its length is also
   * persisted as `totalResults`.
   * @returns The id of the saved `linkedinPeopleSearches` document.
   */
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('linkedinPeopleSearches')
      .withIndex('by_jobResultId', (q) => q.eq('jobResultId', args.jobResultId))
      .first()

    const document = {
      jobResultId: args.jobResultId,
      company: args.company,
      jobTitle: args.jobTitle,
      status: args.status,
      query: args.query,
      summary: args.summary,
      people: args.people,
      totalResults: args.people.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    if (existing !== null) {
      await ctx.db.replace(existing._id, document)
      return existing._id
    }

    return await ctx.db.insert('linkedinPeopleSearches', document)
  },
})
