import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { internalMutation, query } from '../_generated/server'
import { requireAdminUser } from '../auth'
import {
  DEFAULT_ADMIN_SEARCH_LIMIT,
  MAX_ADMIN_SEARCH_LIMIT,
  MAX_SAVED_JOB_RESULTS,
} from '../shared/constants'
import {
  savedJobValidator,
  searchFailureTraceValidator,
  searchStatusValidator,
} from '../shared/validators'

/**
 * Loads the saved jobs for a single search run using the rank index.
 *
 * @param ctx - Query context used to read the `jobResults` table.
 * @param searchRunId - The search run whose jobs should be loaded.
 * @returns The bounded list of saved jobs for the search run.
 */
async function getSavedJobsForSearchRun(
  ctx: QueryCtx,
  searchRunId: Id<'searchRuns'>,
) {
  return await ctx.db
    .query('jobResults')
    .withIndex('by_searchRunId_rank', (q) => q.eq('searchRunId', searchRunId))
    .take(MAX_SAVED_JOB_RESULTS)
}

function resolveJobMatchPercentage(job: {
  relevance?: number
  matchScore?: number
  rank: number
}) {
  if (typeof job.relevance === 'number') {
    return job.relevance
  }

  if (typeof job.matchScore === 'number') {
    return job.matchScore
  }

  return 0
}

/**
 * Clamps the admin search-view limit to a safe bounded range.
 *
 * @param requestedLimit - The optional limit requested by the client.
 * @returns A safe bounded limit for recent-search queries.
 */
function resolveAdminSearchLimit(requestedLimit: number | undefined) {
  const limit = requestedLimit ?? DEFAULT_ADMIN_SEARCH_LIMIT

  if (!Number.isFinite(limit)) {
    return DEFAULT_ADMIN_SEARCH_LIMIT
  }

  return Math.max(1, Math.min(Math.floor(limit), MAX_ADMIN_SEARCH_LIMIT))
}

function queryAdminSearchRunsByCreatedAt(
  ctx: QueryCtx,
  sinceTimestamp: number | undefined,
) {
  if (sinceTimestamp === undefined) {
    return ctx.db.query('searchRuns').withIndex('by_createdAt')
  }

  return ctx.db
    .query('searchRuns')
    .withIndex('by_createdAt', (q) => q.gte('createdAt', sinceTimestamp))
}

/**
 * Persists a search run and any structured job results created for it.
 */
export const saveSearchOutcome = internalMutation({
  args: {
    prompt: v.string(),
    isJobSearch: v.boolean(),
    status: searchStatusValidator,
    tavilyQuery: v.optional(v.string()),
    selectedProviders: v.optional(v.array(v.string())),
    failureTrace: v.optional(searchFailureTraceValidator),
    summary: v.string(),
    categories: v.array(v.string()),
    jobs: v.array(savedJobValidator),
  },
  /**
   * @param ctx - Mutation context used to write the search run and job results.
   * @param args - The fully normalized search outcome to persist.
   * @returns The id of the saved `searchRuns` document.
   */
  handler: async (ctx, args) => {
    const createdAt = Date.now()

    const searchRunId = await ctx.db.insert('searchRuns', {
      prompt: args.prompt,
      isJobSearch: args.isJobSearch,
      status: args.status,
      tavilyQuery: args.tavilyQuery,
      selectedProviders: args.selectedProviders,
      failureTrace: args.failureTrace,
      summary: args.summary,
      categories: args.categories,
      totalResults: args.jobs.length,
      createdAt,
    })

    await Promise.all(
      args.jobs.map((job) =>
        ctx.db.insert('jobResults', {
          searchRunId,
          ...job,
        }),
      ),
    )

    return searchRunId
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
   * @param args - The id of the saved search run to load.
   * @returns The search result page payload or `null` when the search is missing.
   */
  handler: async (ctx, args) => {
    const search = await ctx.db.get(args.searchId)

    if (search === null) {
      return null
    }

    const jobs = await ctx.db
      .query('jobResults')
      .withIndex('by_searchRunId_rank', (q) =>
        q.eq('searchRunId', args.searchId),
      )
      .take(MAX_SAVED_JOB_RESULTS)
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
   * @returns One page of recent search runs with their saved job results.
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
