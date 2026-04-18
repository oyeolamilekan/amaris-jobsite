import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internalQuery, query } from '../_generated/server'
import { requireAdminUser } from '../auth'
import {
  getSavedJobsForSearchRun,
  queryAdminSearchRunsByCreatedAt,
  resolveAdminSearchLimit,
  resolveJobMatchPercentage,
} from './functions'

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

/**
 * Returns the full results payload needed by the UI for one saved search run.
 */
export const getSearchResultPage = query({
  args: {
    searchId: v.id('searchRuns'),
  },
  /**
   * @param ctx - Query context used to read the search run and job results.
   * @param args - Lookup payload for a single saved search run.
   * @param args.searchId - The `searchRuns` document to load for the results
   * page.
   * @returns The public results payload or `null` when the search is missing.
   * The returned search object omits the internal `failureTrace`, and the jobs
   * are sorted by relevance and match score before being returned.
   */
  handler: async (ctx, args) => {
    const search = await ctx.db.get(args.searchId)

    if (search === null) {
      return null
    }

    const jobs = await getSavedJobsForSearchRun(ctx, args.searchId)
    const sortedJobs = [...jobs].sort((a, b) => {
      const matchDifference =
        resolveJobMatchPercentage(b) - resolveJobMatchPercentage(a)

      if (matchDifference !== 0) {
        return matchDifference
      }

      return a.rank - b.rank
    })
    const { failureTrace: _failureTrace, ...publicSearch } = search

    return {
      search: publicSearch,
      jobs: sortedJobs,
    }
  },
})

/**
 * Internal snapshot used by availability-refresh actions before they mutate the
 * saved result set.
 */
export const getSearchAvailabilitySnapshot = internalQuery({
  args: {
    searchId: v.id('searchRuns'),
  },
  /**
   * @param ctx - Query context used by refresh actions before they mutate a
   * saved result set.
   * @param args - Snapshot lookup payload for a single saved search.
   * @param args.searchId - The saved search run to inspect before availability
   * checks are applied.
   * @returns The raw search run plus its saved jobs, or `null` when the search
   * does not exist.
   */
  handler: async (ctx, args) => {
    const search = await ctx.db.get(args.searchId)

    if (search === null) {
      return null
    }

    const jobs = await getSavedJobsForSearchRun(ctx, args.searchId)

    return {
      search,
      jobs,
    }
  },
})

/**
 * Returns a bounded list of recent search runs and their saved job results for
 * the internal admin view.
 */
export const getAdminSearchRuns = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sinceTimestamp: v.optional(v.number()),
  },
  /**
   * @param ctx - Query context used to read recent search runs and their jobs.
   * @param args - Cursor-based pagination options and optional time filter.
   * @param args.paginationOpts - Standard Convex pagination settings. The
   * requested `numItems` value is clamped server-side to a safe admin limit
   * before the query is executed.
   * @param args.sinceTimestamp - Optional Unix-millisecond lower bound for
   * `searchRuns.createdAt`. When omitted, the query returns searches from all
   * time.
   * @returns One page of recent search runs with their saved job results,
   * ordered newest-first.
   */
  handler: async (ctx, args) => {
    await requireAdminUser(ctx)
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: resolveAdminSearchLimit(args.paginationOpts.numItems),
    }
    const searchPage = await queryAdminSearchRunsByCreatedAt(
      ctx,
      args.sinceTimestamp,
    )
      .order('desc')
      .paginate(paginationOpts)

    return {
      ...searchPage,
      page: await Promise.all(
        searchPage.page.map(async (search) => {
          const jobs = await getSavedJobsForSearchRun(ctx, search._id)

          return { search, jobs }
        }),
      ),
    }
  },
})

/**
 * Aggregate stats for search runs within an optional time window.
 * Used by the admin dashboard stat cards with time-period filtering.
 */
export const getAdminSearchStats = query({
  args: {
    sinceTimestamp: v.optional(v.number()),
  },
  /**
   * @param ctx - Query context used to aggregate saved-search statistics for
   * the admin dashboard.
   * @param args - Optional time-window filter for the aggregate query.
   * @param args.sinceTimestamp - Optional Unix-millisecond lower bound for
   * `searchRuns.createdAt`. When omitted, the stats cover all saved search
   * runs.
   * @returns Aggregate counts for total runs, completed runs, failed runs, and
   * total saved jobs within the requested window.
   */
  handler: async (ctx, args) => {
    await requireAdminUser(ctx)
    const docs = await queryAdminSearchRunsByCreatedAt(
      ctx,
      args.sinceTimestamp,
    ).collect()

    let completed = 0
    let failed = 0
    let totalJobs = 0

    for (const doc of docs) {
      if (doc.status === 'completed') completed++
      else if (doc.status === 'failed') failed++
      totalJobs += doc.totalResults
    }

    return {
      total: docs.length,
      completed,
      failed,
      totalJobs,
    }
  },
})
