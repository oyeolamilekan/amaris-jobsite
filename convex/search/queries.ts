import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { internalMutation, internalQuery, query } from '../_generated/server'
import { requireAdminUser } from '../auth'
import {
  DEFAULT_ADMIN_SEARCH_LIMIT,
  MAX_ADMIN_SEARCH_LIMIT,
  MAX_SAVED_JOB_RESULTS,
} from '../shared/constants'
import { buildJobSearchSummary } from './summary'
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

/**
 * Builds the base search-run query used by the admin views, with an optional
 * lower bound on `createdAt`.
 *
 * @param ctx - Query context used to create the indexed `searchRuns` query.
 * @param sinceTimestamp - Optional Unix-millisecond lower bound for the
 * `createdAt` field. When omitted, the query spans all saved search runs.
 * @returns An indexed Convex query scoped for the requested time window.
 */
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
   * @param args.prompt - The original prompt associated with the saved search
   * run.
   * @param args.isJobSearch - Whether the prompt was classified as a real job
   * search.
   * @param args.status - The terminal lifecycle state for the run, such as
   * `completed`, `not_job_search`, or `failed`.
   * @param args.tavilyQuery - Optional generated Tavily query string. This is
   * typically present for real job searches and omitted when the search exits
   * early or no query was produced.
   * @param args.selectedProviders - Optional provider ids captured for the run.
   * When omitted, no explicit provider selection was persisted.
   * @param args.failureTrace - Optional serialized failure metadata for failed
   * runs. Omitted for successful and early-exit runs.
   * @param args.summary - Human-readable summary shown back to the UI.
   * @param args.categories - Saved category labels for the run. This may be an
   * empty array when no categories were inferred.
   * @param args.jobs - Fully normalized job payloads to insert into
   * `jobResults`. The mutation uses this array both for inserts and for
   * computing `totalResults`.
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
 * Applies the outcome of a saved-job availability refresh by deleting
 * unavailable postings, updating last-checked timestamps for survivors, and
 * keeping the parent search summary/counts in sync.
 */
export const applySearchAvailabilityRefresh = internalMutation({
  args: {
    searchId: v.id('searchRuns'),
    checkedJobs: v.array(
      v.object({
        jobResultId: v.id('jobResults'),
        availabilityCheckedAt: v.number(),
      }),
    ),
    unavailableJobIds: v.array(v.id('jobResults')),
  },
  /**
   * @param ctx - Mutation context used to delete unavailable jobs, patch
   * survivors, and update the parent search summary.
   * @param args - Availability refresh payload computed by the action layer.
   * @param args.searchId - The parent `searchRuns` document being refreshed.
   * @param args.checkedJobs - Jobs that were rechecked and are still considered
   * live. Their `availabilityCheckedAt` timestamps are patched in place.
   * @param args.unavailableJobIds - Saved job ids that should be removed from
   * the result set because direct URL checks classified them as unavailable.
   * Any linked `linkedinPeopleSearches` documents are deleted first.
   * @returns Counts for how many jobs were removed and how many remain after the
   * refresh completes. Missing searches return zero counts.
   */
  handler: async (ctx, args) => {
    const search = await ctx.db.get(args.searchId)

    if (search === null) {
      return {
        removedCount: 0,
        remainingCount: 0,
      }
    }

    const jobs = await getSavedJobsForSearchRun(ctx, args.searchId)
    const liveJobIds = new Set(jobs.map((job) => job._id))
    let removedCount = 0

    for (const jobId of new Set(args.unavailableJobIds)) {
      if (!liveJobIds.has(jobId)) {
        continue
      }

      const linkedInSearches = await ctx.db
        .query('linkedinPeopleSearches')
        .withIndex('by_jobResultId', (q) => q.eq('jobResultId', jobId))
        .take(10)

      for (const linkedInSearch of linkedInSearches) {
        await ctx.db.delete(linkedInSearch._id)
      }

      await ctx.db.delete(jobId)
      liveJobIds.delete(jobId)
      removedCount++
    }

    for (const checkedJob of args.checkedJobs) {
      if (!liveJobIds.has(checkedJob.jobResultId)) {
        continue
      }

      await ctx.db.patch(checkedJob.jobResultId, {
        availabilityCheckedAt: checkedJob.availabilityCheckedAt,
      })
    }

    const remainingJobs = await getSavedJobsForSearchRun(ctx, args.searchId)
    const nextTotalResults = remainingJobs.length
    const nextSummary =
      search.isJobSearch && search.status === 'completed'
        ? buildJobSearchSummary(nextTotalResults)
        : search.summary

    if (
      nextTotalResults !== search.totalResults ||
      nextSummary !== search.summary
    ) {
      await ctx.db.patch(args.searchId, {
        totalResults: nextTotalResults,
        summary: nextSummary,
      })
    }

    return {
      removedCount,
      remainingCount: nextTotalResults,
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
