import { v } from 'convex/values'
import { internalMutation, mutation } from '../_generated/server'
import {
  buildJobSearchSummary,
  getSavedJobsForSearchRun,
} from './functions'
import { searchProgressStageValidator } from '../shared/validators'
import {
  savedJobValidator,
  searchFailureTraceValidator,
  searchStatusValidator,
} from '../shared/validators'

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
