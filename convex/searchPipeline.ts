import { internal } from './_generated/api'
import type { ActionCtx } from './_generated/server'
import { getSearchRuntimeConfig } from './searchEnv'
import {
  FAILED_SEARCH_SUMMARY,
  toFailureTrace,
  type SearchFailureStage,
} from './searchFailure'
import { generateSearchQuery } from './searchFacets'
import { tavilyResultsToJobs } from './searchNormalize'
import { extractAllJobDetails } from './searchExtract'
import { searchTavilyJobs } from './searchTavily'

/**
 * Classifies the prompt and generates a Tavily query via a single LLM call.
 * Returns the intent and the generated query string.
 */
export async function classifyAndBuildQuery(
  prompt: string,
  selectedProviders?: string[],
) {
  return generateSearchQuery(prompt, selectedProviders)
}

/**
 * Runs the core search pipeline: Tavily retrieval → direct mapping to jobs.
 * Returns everything needed to persist a completed search.
 */
export async function runJobSearchPipeline(tavilyQuery: string) {
  const { tavilyApiKey } = getSearchRuntimeConfig()

  const tavilyResults = await searchTavilyJobs(tavilyApiKey, tavilyQuery)

  const extractions = await extractAllJobDetails(tavilyResults.results)

  const jobs = tavilyResultsToJobs(tavilyResults.results, extractions)

  const summary =
    jobs.length > 0
      ? `Found ${jobs.length} job opening${jobs.length === 1 ? '' : 's'} from job board search results.`
      : 'No job openings were found for this search.'

  return {
    summary,
    categories: [] as string[],
    jobs,
  }
}

/**
 * Persists a failed search run. Swallows save errors to avoid masking the
 * original pipeline failure.
 */
export async function persistFailedSearch(
  ctx: ActionCtx,
  opts: {
    prompt: string
    isJobSearch: boolean
    tavilyQuery?: string
    stage: SearchFailureStage
    tavilyRequestId?: string
    error: unknown
    selectedProviders?: string[]
  },
) {
  const failureTrace = toFailureTrace(
    opts.error,
    opts.stage,
    opts.tavilyRequestId,
  )

  try {
    await ctx.runMutation(internal.search.saveSearchOutcome, {
      prompt: opts.prompt,
      isJobSearch: opts.isJobSearch,
      status: 'failed' as const,
      summary: FAILED_SEARCH_SUMMARY,
      categories: [],
      jobs: [],
      failureTrace,
      tavilyQuery: opts.tavilyQuery,
      selectedProviders: opts.selectedProviders,
    })
  } catch (saveError) {
    console.error('Failed to persist failed search trace.', {
      prompt: opts.prompt,
      stage: failureTrace.stage,
      error: saveError instanceof Error ? saveError.message : String(saveError),
    })
  }
}
