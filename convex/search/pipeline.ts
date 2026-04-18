import { internal } from '../_generated/api'
import type { ActionCtx } from '../_generated/server'
import { resolveJobSearchDomains } from '../shared/constants'
import { getSearchRuntimeConfig } from '../shared/env'
import {
  FAILED_SEARCH_SUMMARY,
  toFailureTrace,
  type SearchFailureStage,
} from '../shared/failure'
import { generateSearchQuery } from './facets'
import { tavilyResultsToJobs } from './normalize'
import { extractAllJobDetails } from './extract'
import { checkJobPostingAvailabilityBatch } from './availability'
import { buildJobSearchSummary } from './summary'
import { searchTavilyJobs } from '../shared/tavily'

/**
 * Classifies the prompt and generates a Tavily query via a single LLM call.
 * Domain filters are applied later at the Tavily request layer.
 *
 * @param prompt - Raw user prompt to classify.
 * @param modelId - Optional AI model override for the classification call.
 * @returns The normalized intent and query payload produced by
 * `generateSearchQuery(...)`.
 */
export async function classifyAndBuildQuery(prompt: string, modelId?: string) {
  return generateSearchQuery(prompt, modelId)
}

/**
 * Runs the core search pipeline: domain-scoped Tavily retrieval → direct
 * mapping to jobs. Returns everything needed to persist a completed search.
 *
 * @param prompt - Original user prompt used for query generation and
 * relevance-aware extraction.
 * @param tavilyQuery - Final Tavily query string produced by the prompt
 * classification step.
 * @param selectedProviders - Optional provider ids used to derive the allowed
 * domain list. When omitted, the default provider selection is used.
 * @param modelId - Optional AI model override used during job extraction.
 * @returns A persistence-ready payload containing the final search summary,
 * categories, and normalized job list.
 */
export async function runJobSearchPipeline(
  prompt: string,
  tavilyQuery: string,
  selectedProviders?: string[],
  modelId?: string,
) {
  const { tavilyApiKey } = getSearchRuntimeConfig()
  const includeDomains = resolveJobSearchDomains(selectedProviders)

  const tavilyResults = await searchTavilyJobs(tavilyApiKey, tavilyQuery, {
    includeDomains,
  })

  const availabilityChecks = await checkJobPostingAvailabilityBatch(
    tavilyResults.results,
  )
  const liveCandidates = tavilyResults.results
    .map((result, index) => ({
      availabilityCheck: availabilityChecks[index],
      result,
    }))
    .filter(
      (candidate) => candidate.availabilityCheck?.status !== 'unavailable',
    )
  const liveResults = liveCandidates.map((candidate) => candidate.result)
  const liveAvailabilityChecks = liveCandidates.map(
    (candidate) => candidate.availabilityCheck,
  )

  const extractions = await extractAllJobDetails(
    liveResults,
    prompt,
    modelId,
  )

  const jobs = tavilyResultsToJobs(
    liveResults,
    extractions,
    liveAvailabilityChecks,
  )
  const summary = buildJobSearchSummary(jobs.length)

  return {
    summary,
    categories: [] as string[],
    jobs,
  }
}

/**
 * Persists a failed search run. Swallows save errors to avoid masking the
 * original pipeline failure.
 *
 * @param ctx - Action context used to persist the failed search outcome.
 * @param opts - Failure persistence payload from the action layer.
 * @param opts.prompt - Original user prompt associated with the failed run.
 * @param opts.isJobSearch - Best-known job-search classification at the moment
 * of failure.
 * @param opts.tavilyQuery - Optional generated Tavily query available at the
 * time the failure occurred.
 * @param opts.stage - Pipeline stage label used when building the failure
 * trace.
 * @param opts.tavilyRequestId - Optional Tavily request id for downstream
 * debugging.
 * @param opts.error - Original caught error value.
 * @param opts.selectedProviders - Optional provider selection captured for the
 * failed run.
 * @returns Nothing. Persistence failures are intentionally swallowed so the
 * original search error is not masked.
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
    await ctx.runMutation(internal.search.queries.saveSearchOutcome, {
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
