import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internalQuery, query } from '../_generated/server'
import { requireAdminUser } from '../auth'
import { linkedinPeopleSearchModeValidator } from '../shared/validators'
import {
  queryAdminLinkedInSearchesByCreatedAt,
  resolveAdminLinkedInLimit,
} from './functions'

/**
 * Paginated admin query for all LinkedIn people searches, ordered by
 * most-recently created first. Includes minimal job context for each search.
 */
export const getAdminLinkedInSearches = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sinceTimestamp: v.optional(v.number()),
  },
  /**
   * @param ctx - Query context used to read paginated LinkedIn people searches
   * for the admin dashboard.
   * @param args - Cursor-based pagination options and optional time filter.
   * @param args.paginationOpts - Standard Convex pagination settings. The
   * requested `numItems` value is clamped into a safe admin range before the
   * query runs.
   * @param args.sinceTimestamp - Optional Unix-millisecond lower bound for
   * `linkedinPeopleSearches.createdAt`. When omitted, the query returns all
   * saved searches.
   * @returns One page of saved LinkedIn people searches, ordered newest-first,
   * plus minimal job context for each record when its source job still exists.
   */
  handler: async (ctx, args) => {
    await requireAdminUser(ctx)
    const numItems = resolveAdminLinkedInLimit(args.paginationOpts.numItems)
    const paginationOpts = { ...args.paginationOpts, numItems }
    const page = await queryAdminLinkedInSearchesByCreatedAt(
      ctx,
      args.sinceTimestamp,
    )
      .order('desc')
      .paginate(paginationOpts)

    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (search) => {
          const job = await ctx.db.get(search.jobResultId)
          return {
            search,
            jobContext: job
              ? {
                  title: job.title,
                  company: job.company,
                  location: job.location,
                }
              : null,
          }
        }),
      ),
    }
  },
})

/**
 * Aggregate stats for LinkedIn people searches within an optional time window.
 * Used by the admin dashboard stat cards with time-period filtering.
 */
export const getAdminLinkedInStats = query({
  args: {
    sinceTimestamp: v.optional(v.number()),
  },
  /**
   * @param ctx - Query context used to aggregate LinkedIn-search statistics for
   * the admin dashboard.
   * @param args - Optional time-window filter for the aggregate query.
   * @param args.sinceTimestamp - Optional Unix-millisecond lower bound for
   * `linkedinPeopleSearches.createdAt`. When omitted, the stats cover all saved
   * LinkedIn searches.
   * @returns Aggregate counts for total searches, completed searches, and
   * searches that produced no results within the requested window.
   */
  handler: async (ctx, args) => {
    await requireAdminUser(ctx)
    const docs = await queryAdminLinkedInSearchesByCreatedAt(
      ctx,
      args.sinceTimestamp,
    ).collect()

    let completed = 0
    let noResults = 0

    for (const doc of docs) {
      if (doc.status === 'completed') completed++
      else if (doc.status === 'no_results') noResults++
    }

    return {
      total: docs.length,
      completed,
      noResults,
    }
  },
})

/**
 * Internal lookup used by actions to check whether a job already has a cached
 * LinkedIn people search.
 */
export const getLinkedInPeopleSearchForJobInternal = internalQuery({
  args: {
    jobResultId: v.id('jobResults'),
    mode: linkedinPeopleSearchModeValidator,
  },
  /**
   * @param ctx - Query context used to read cached LinkedIn people searches.
   * @param args - Internal lookup payload for a saved job result.
   * @param args.jobResultId - The `jobResults` document whose cached LinkedIn
   * enrichment should be checked.
   * @param args.mode - Search mode for the cached lookup.
   * @returns The cached LinkedIn people search document or `null`.
   */
  handler: async (ctx, args) => {
    return await ctx.db
      .query('linkedinPeopleSearches')
      .withIndex('by_jobResultId_and_mode', (q) =>
        q.eq('jobResultId', args.jobResultId).eq('mode', args.mode),
      )
      .first()
  },
})

/**
 * Public lookup used by the UI to read the saved LinkedIn people search for a
 * job result.
 */
export const getLinkedInPeopleSearchForJob = query({
  args: {
    jobResultId: v.id('jobResults'),
    mode: linkedinPeopleSearchModeValidator,
  },
  /**
   * @param ctx - Query context used to read the saved LinkedIn people search.
   * @param args - Public lookup payload for the LinkedIn people dialog.
   * @param args.jobResultId - The `jobResults` document selected in the UI.
   * @param args.mode - Search mode selected in the LinkedIn people dialog.
   * @returns The saved LinkedIn people search document or `null`.
   */
  handler: async (ctx, args) => {
    return await ctx.db
      .query('linkedinPeopleSearches')
      .withIndex('by_jobResultId_and_mode', (q) =>
        q.eq('jobResultId', args.jobResultId).eq('mode', args.mode),
      )
      .first()
  },
})

/**
 * Internal lookup that returns the minimum job context required to build a
 * LinkedIn people search.
 */
export const getLinkedInPeopleJobContextInternal = internalQuery({
  args: {
    jobResultId: v.id('jobResults'),
  },
  /**
   * @param ctx - Query context used to read the source job result.
   * @param args - Internal lookup payload for the source job.
   * @param args.jobResultId - The saved job whose title, company, location, and
   * category should be returned for LinkedIn query construction.
   * @returns The minimal job context needed for LinkedIn search, or `null`.
   */
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobResultId)

    if (job === null) {
      return null
    }

    return {
      _id: job._id,
      title: job.title,
      company: job.company,
      location: job.location,
      summary: job.summary,
      category: job.category,
    }
  },
})
