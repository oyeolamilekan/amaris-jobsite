'use node'

import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { action } from '../_generated/server'
import {
  type SearchProgressStage,
} from '../shared/constants'
import {
  checkJobPostingAvailabilityBatch,
  classifyAndBuildQuery,
  persistFailedSearch,
  resolveSelectedProviders,
  runJobSearchPipeline,
  shouldRecheckJobPosting,
} from './functions'
import { assertAiGatewayConfigured } from '../shared/env'
import {
  NOT_JOB_SEARCH_SUMMARY,
  SearchStageError,
  type SearchFailureStage,
} from '../shared/failure'

/**
 * Main action entrypoint for a user-submitted search. Classifies the prompt
 * via a single LLM call, runs Tavily retrieval when appropriate, structures
 * the results, and persists the final search run.
 */
export const submitSearch = action({
  args: {
    prompt: v.string(),
    progressId: v.optional(v.id('searchProgress')),
    selectedProviders: v.optional(v.array(v.string())),
  },
  /**
   * @param ctx - Action context used to read admin settings, call internal
   * queries and mutations, update progress, and persist failure traces.
   * @param args - Search submission payload from the frontend.
   * @param args.prompt - The raw user prompt. The action trims this value and
   * rejects the request if the trimmed result is empty.
   * @param args.progressId - Optional id of a `searchProgress` document created
   * before the action starts. When provided, the action reports analyzing,
   * searching, saving, completed, and failed stages back to the loading UI.
   * @param args.selectedProviders - Optional list of provider ids to constrain
   * the search. When omitted or empty, the default provider selection is used.
   * Duplicate values are removed, unsupported providers throw, and selections
   * above `MAX_SELECTED_PROVIDERS` are rejected.
   * @returns The id of the saved `searchRuns` document for the completed or
   * early-exit search run.
   */
  handler: async (ctx, args): Promise<{ searchId: Id<'searchRuns'> }> => {
    const prompt = args.prompt.trim()
    if (!prompt) throw new Error('Please enter a search prompt.')

    const { progressId } = args
    const selectedProviders = resolveSelectedProviders(args.selectedProviders)

    async function reportProgress(
      stage: SearchProgressStage,
      extra?: { searchId?: Id<'searchRuns'>; error?: string },
    ) {
      if (!progressId) return
      await ctx.runMutation(internal.search.mutations.updateSearchProgress, {
        progressId,
        stage,
        ...extra,
      })
    }

    let stage: SearchFailureStage = 'prompt-analysis'
    let isJobSearch = false
    let tavilyQuery: string | undefined

    try {
      stage = 'runtime-config'
      assertAiGatewayConfigured()

      // 0. Read admin AI model setting
      const settings = await ctx.runQuery(
        internal.admin.queries.getSettingsInternal,
        {},
      )
      const modelId = settings.aiModel

      // 1. Classify intent + generate Tavily query (single LLM call)
      stage = 'prompt-analysis'
      const result = await classifyAndBuildQuery(prompt, modelId)

      // 2. Non-job-search early exit
      if (result.intent !== 'job_search') {
        stage = 'search-persistence'
        await reportProgress('saving')
        const searchId = await ctx.runMutation(
          internal.search.mutations.saveSearchOutcome,
          {
            prompt,
            isJobSearch: false,
            status: 'not_job_search',
            summary: NOT_JOB_SEARCH_SUMMARY,
            categories: [],
            jobs: [],
            selectedProviders,
          },
        )
        await reportProgress('completed', { searchId })
        return { searchId }
      }

      // 3. Run the search pipeline
      isJobSearch = true
      tavilyQuery = result.query
      stage = 'tavily-search'
      await reportProgress('searching')
      const pipeline = await runJobSearchPipeline(
        prompt,
        tavilyQuery,
        selectedProviders,
        modelId,
      )

      // 4. Persist completed results
      stage = 'search-persistence'
      await reportProgress('saving')
      const searchId = await ctx.runMutation(
        internal.search.mutations.saveSearchOutcome,
        {
          prompt,
          isJobSearch: true,
          status: 'completed',
          summary: pipeline.summary,
          categories: pipeline.categories,
          jobs: pipeline.jobs,
          tavilyQuery,
          selectedProviders,
        },
      )
      await reportProgress('completed', { searchId })
      return { searchId }
    } catch (error) {
      console.log(error)

      await reportProgress('failed', {
        error: error instanceof Error ? error.message : 'Search failed',
      })

      await persistFailedSearch(ctx, {
        prompt,
        isJobSearch,
        tavilyQuery,
        stage,
        error,
        selectedProviders,
      })

      throw new Error(
        error instanceof SearchStageError
          ? error.message
          : 'Something went wrong while processing this search. Please try again.',
      )
    }
  },
})

/**
 * Revalidates saved job URLs before the results page is displayed, pruning
 * postings that are clearly no longer live.
 */
export const refreshSearchResultsAvailability = action({
  args: {
    searchId: v.id('searchRuns'),
  },
  /**
   * @param ctx - Action context used to read the saved search snapshot, perform
   * availability checks, and persist the refresh outcome.
   * @param args - Availability-refresh payload for a saved search.
   * @param args.searchId - The saved search run to revalidate before rendering
   * the results page.
   * @returns Counts describing how many jobs were checked, removed, and left in
   * the saved result set. `skipped` is `true` when the search is missing, is
   * not a completed job search, has no jobs, or has no jobs that need
   * rechecking.
   */
  handler: async (
    ctx,
    args,
  ): Promise<{
    checkedCount: number
    removedCount: number
    remainingCount: number
    skipped: boolean
  }> => {
    const snapshot = await ctx.runQuery(
      internal.search.queries.getSearchAvailabilitySnapshot,
      {
        searchId: args.searchId,
      },
    )

    if (snapshot === null) {
      return {
        checkedCount: 0,
        removedCount: 0,
        remainingCount: 0,
        skipped: true,
      }
    }

    if (
      !snapshot.search.isJobSearch ||
      snapshot.search.status !== 'completed' ||
      snapshot.jobs.length === 0
    ) {
      return {
        checkedCount: 0,
        removedCount: 0,
        remainingCount: snapshot.jobs.length,
        skipped: true,
      }
    }

    const jobsToCheck = snapshot.jobs.filter((job) =>
      shouldRecheckJobPosting(job.availabilityCheckedAt),
    )

    if (jobsToCheck.length === 0) {
      return {
        checkedCount: 0,
        removedCount: 0,
        remainingCount: snapshot.jobs.length,
        skipped: true,
      }
    }

    const checks = await checkJobPostingAvailabilityBatch(jobsToCheck)
    const unavailableJobIds: Id<'jobResults'>[] = []
    const checkedJobs: Array<{
      jobResultId: Id<'jobResults'>
      availabilityCheckedAt: number
    }> = []

    jobsToCheck.forEach((job, index) => {
      const check = checks[index]

      if (!check) {
        return
      }

      if (check.status === 'unavailable') {
        unavailableJobIds.push(job._id)
        return
      }

      checkedJobs.push({
        jobResultId: job._id,
        availabilityCheckedAt: check.checkedAt,
      })
    })

    const result = await ctx.runMutation(
      internal.search.mutations.applySearchAvailabilityRefresh,
      {
        searchId: args.searchId,
        checkedJobs,
        unavailableJobIds,
      },
    )

    return {
      checkedCount: jobsToCheck.length,
      removedCount: result.removedCount,
      remainingCount: result.remainingCount,
      skipped: false,
    }
  },
})
