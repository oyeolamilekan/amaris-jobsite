'use node'

import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { action } from '../_generated/server'
import { assertAiGatewayConfigured } from '../shared/env'
import {
  NOT_JOB_SEARCH_SUMMARY,
  SearchStageError,
  type SearchFailureStage,
} from '../shared/failure'
import {
  classifyAndBuildQuery,
  persistFailedSearch,
  runJobSearchPipeline,
} from './pipeline'
import type { SearchProgressStage } from '../shared/constants'

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
  handler: async (ctx, args): Promise<{ searchId: Id<'searchRuns'> }> => {
    const prompt = args.prompt.trim()
    if (!prompt) throw new Error('Please enter a search prompt.')

    const { progressId, selectedProviders } = args

    async function reportProgress(
      stage: SearchProgressStage,
      extra?: { searchId?: Id<'searchRuns'>; error?: string },
    ) {
      if (!progressId) return
      await ctx.runMutation(internal.search.progress.updateSearchProgress, {
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
        internal.admin.settings.getSettingsInternal,
        {},
      )
      const modelId = settings.aiModel

      // 1. Classify intent + generate Tavily query (single LLM call)
      stage = 'prompt-analysis'
      const result = await classifyAndBuildQuery(
        prompt,
        selectedProviders,
        modelId,
      )

      // 2. Non-job-search early exit
      if (result.intent !== 'job_search') {
        stage = 'search-persistence'
        await reportProgress('saving')
        const searchId = await ctx.runMutation(
          internal.search.queries.saveSearchOutcome,
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
      const pipeline = await runJobSearchPipeline(prompt, tavilyQuery, modelId)

      // 4. Persist completed results
      stage = 'search-persistence'
      await reportProgress('saving')
      const searchId = await ctx.runMutation(
        internal.search.queries.saveSearchOutcome,
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
