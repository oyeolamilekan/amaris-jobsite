import {
  DEFAULT_TAVILY_MAX_RESULTS,
  DEFAULT_TAVILY_SEARCH_DEPTH,
  MAX_TAVILY_QUERY_LENGTH,
  TAVILY_SEARCH_URL,
} from './constants'
import { SearchStageError, serializeFailureDetails } from './failure'

/**
 * Raw subset of the Tavily API response used by this application.
 */
type TavilySearchResponse = {
  query: string
  results: Array<{
    title: string
    url: string
    content: string
    score: number
    favicon?: string | null
    raw_content: string | null
  }>
  request_id: string
  response_time: string | number
}

/**
 * Normalized Tavily result shape used throughout the job-search pipeline.
 */
export type TavilySearchResult = {
  results: Array<{
    title: string
    url: string
    content: string
    score: number
    favicon: string | null
    rawContent: string | null
  }>
}

/**
 * Executes a Tavily search request and normalizes the response into the app's
 * internal result shape.
 *
 * @param apiKey - The Tavily API key used for authentication.
 * @param query - The already-normalized query string to execute.
 * @param options - Optional search-depth, domain, and result-count overrides.
 * @returns A normalized Tavily result payload.
 */
export async function searchTavily(
  apiKey: string,
  query: string,
  options?: {
    searchDepth?: 'basic' | 'advanced'
    maxResults?: number
    includeRawContent?: boolean
    timeRange?: 'day' | 'week' | 'month' | 'year'
    includeDomains?: readonly string[]
  },
) {
  const searchDepth = options?.searchDepth ?? DEFAULT_TAVILY_SEARCH_DEPTH
  const maxResults = options?.maxResults ?? DEFAULT_TAVILY_MAX_RESULTS
  const includeRawContent = options?.includeRawContent ?? false
  const timeRange = options?.timeRange
  const includeDomains = options?.includeDomains

  if (query.length > MAX_TAVILY_QUERY_LENGTH) {
    throw new SearchStageError({
      stage: 'tavily-search',
      message:
        'The generated search query was too long for Tavily after normalization.',
      details: serializeFailureDetails({
        queryLength: query.length,
        maxLength: MAX_TAVILY_QUERY_LENGTH,
        query,
      }),
    })
  }

  const response = await fetch(TAVILY_SEARCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      search_depth: searchDepth,
      topic: 'general',
      max_results: maxResults,
      include_answer: false,
      include_images: false,
      include_raw_content: 'text',
      include_favicon: true,
      ...(timeRange ? { time_range: timeRange } : {}),
      ...(includeDomains && includeDomains.length > 0
        ? { include_domains: includeDomains }
        : {}),
      include_usage: false,
    }),
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new SearchStageError({
      stage: 'tavily-search',
      message: `Tavily search failed with status ${response.status}.`,
      underlyingErrorName: 'TavilySearchError',
      responseText,
      details: serializeFailureDetails({
        status: response.status,
        statusText: response.statusText,
      }),
    })
  }

  let data: TavilySearchResponse

  try {
    data = JSON.parse(responseText) as TavilySearchResponse
  } catch (error) {
    throw new SearchStageError({
      stage: 'tavily-search',
      message: 'Tavily returned an unreadable response payload.',
      underlyingErrorName:
        error instanceof Error ? error.name : 'TavilyResponseParseError',
      responseText,
      details: serializeFailureDetails({
        error: error instanceof Error ? error.message : String(error),
      }),
      cause: error,
    })
  }

  return {
    results: data.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
      favicon: result.favicon ?? null,
      rawContent: result.raw_content,
    })),
  } satisfies TavilySearchResult
}

/**
 * Convenience wrapper for the default Tavily job-search configuration.
 *
 * @param apiKey - The Tavily API key used for authentication.
 * @param query - The final job-search query.
 * @returns A normalized Tavily result payload using the default job settings.
 */
export async function searchTavilyJobs(
  apiKey: string,
  query: string,
  options?: {
    includeDomains?: readonly string[]
  },
) {
  return await searchTavily(apiKey, query, {
    includeRawContent: true,
    timeRange: 'week',
    includeDomains: options?.includeDomains,
  })
}
