import {
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  generateText,
} from 'ai'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { ActionCtx, QueryCtx } from '../_generated/server'
import {
  DEFAULT_ADMIN_SEARCH_LIMIT,
  JOB_AVAILABILITY_CHECK_TIMEOUT_MS,
  JOB_AVAILABILITY_RECHECK_INTERVAL_MS,
  MAX_ADMIN_SEARCH_LIMIT,
  MAX_SAVED_JOB_RESULTS,
  MAX_SELECTED_PROVIDERS,
  defaultProviders,
  resolveJobSearchDomains,
} from '../shared/constants'
import { getSearchRuntimeConfig } from '../shared/env'
import {
  FAILED_SEARCH_SUMMARY,
  SearchStageError,
  serializeFailureDetails,
  toFailureTrace,
  type SearchFailureStage,
} from '../shared/failure'
import { getJobSearchModel } from '../shared/model'
import {
  extractJobDetailsSystem,
  generateSearchQuerySystem,
} from '../shared/prompts'
import {
  jobExtractionSchema,
  searchQuerySchema,
  type JobExtraction,
} from '../shared/schemas'
import { searchTavilyJobs, type TavilySearchResult } from '../shared/tavily'
import {
  GENERIC_UNAVAILABLE_PATTERNS,
  HOST_UNAVAILABLE_PATTERNS,
  MAX_JOB_SUMMARY_LENGTH,
  approvedProviderSet,
} from './constants'

type TavilySingleResult = TavilySearchResult['results'][number]
type SearchReadCtx = { db: QueryCtx['db'] }

/**
 * Null extraction used as a safe fallback when the LLM call fails or produces
 * no usable output.
 */
const NULL_EXTRACTION: JobExtraction = {
  company: null,
  location: null,
  summary: null,
  source: null,
  category: null,
  employmentType: null,
  relevance: null,
  tags: null,
}

/**
 * Normalizes an optional provider selection into a validated list of approved
 * provider ids.
 *
 * @param selectedProviders - Optional provider keys from the client. When the
 * array is omitted or empty, the default provider list is used. Duplicate
 * values are removed, unsupported providers are rejected, and selections above
 * `MAX_SELECTED_PROVIDERS` throw.
 * @returns A deduplicated list of approved provider ids.
 */
export function resolveSelectedProviders(selectedProviders?: string[]) {
  if (!selectedProviders || selectedProviders.length === 0) {
    return [...defaultProviders]
  }

  const uniqueSelectedProviders = Array.from(new Set(selectedProviders))

  if (uniqueSelectedProviders.length > MAX_SELECTED_PROVIDERS) {
    throw new Error(
      `You can select up to ${MAX_SELECTED_PROVIDERS} job boards.`,
    )
  }

  const invalidProvider = uniqueSelectedProviders.find(
    (provider) => !approvedProviderSet.has(provider),
  )

  if (invalidProvider) {
    throw new Error('Unsupported job board selection.')
  }

  return uniqueSelectedProviders
}

/**
 * Normalizes the raw intent string into one of the two supported values.
 *
 * @param value - Raw intent text returned by the model.
 * @returns Either `job_search` or `not_job_search`. Unknown or ambiguous
 * labels intentionally fall back to `not_job_search` so the pipeline stays
 * conservative.
 */
function normalizeIntent(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (normalized.includes('not')) return 'not_job_search' as const
  if (normalized.includes('job')) return 'job_search' as const
  return 'not_job_search' as const
}

/**
 * Calls the LLM to classify the user prompt and generate a Tavily Boolean
 * query. Domain scoping is applied when Tavily is called.
 *
 * @param prompt - Raw user prompt to classify and convert into a Tavily query.
 * @param modelId - Optional AI Gateway model id override. When omitted, the
 * configured default model is used.
 * @returns An object containing a normalized `intent` label and a trimmed
 * Tavily query string. Non-job-search responses intentionally return an empty
 * query string.
 */
export async function generateSearchQuery(prompt: string, modelId?: string) {
  try {
    const { output } = await generateText({
      model: getJobSearchModel(modelId),
      maxOutputTokens: 2048,
      system: generateSearchQuerySystem,
      prompt: `User prompt: ${prompt}`,
      output: Output.object({
        schema: searchQuerySchema,
      }),
    })

    if (!output) {
      throw new SearchStageError({
        stage: 'prompt-analysis',
        message:
          'Search analysis returned an empty response. Please try your query again.',
        underlyingErrorName: 'EmptyOutput',
      })
    }

    console.log(output)

    return {
      intent: normalizeIntent(output.intent),
      query: output.query?.trim() || '',
    }
  } catch (error) {
    if (error instanceof SearchStageError) throw error

    if (error instanceof Error && error.name === 'GatewayAuthenticationError') {
      const text = 'text' in error ? (error.text as string) : undefined

      console.error(
        'Search query generation could not authenticate with AI Gateway.',
        {
          prompt,
          error: error.message,
          text,
        },
      )

      throw new SearchStageError({
        stage: 'runtime-config',
        message:
          'AI Gateway authentication failed. Check AI_GATEWAY_API_KEY in the runtime environment.',
        underlyingErrorName: error.name,
        responseText: text,
        details: serializeFailureDetails({
          error: error.message,
          cause:
            error.cause instanceof Error ? error.cause.message : error.cause,
        }),
        cause: error,
      })
    }

    if (
      NoObjectGeneratedError.isInstance(error) ||
      NoOutputGeneratedError.isInstance(error)
    ) {
      const text = 'text' in error ? (error.text as string) : undefined

      console.error('Search query generation failed.', { prompt, text })

      throw new SearchStageError({
        stage: 'prompt-analysis',
        message:
          'Search analysis returned an unexpected format. Please try your query again.',
        underlyingErrorName: error.name,
        responseText: text,
        details: serializeFailureDetails({
          cause:
            error.cause instanceof Error ? error.cause.message : error.cause,
        }),
        cause: error,
      })
    }

    if (error instanceof Error) {
      const text = 'text' in error ? (error.text as string) : undefined

      console.error('Search query generation failed unexpectedly.', {
        prompt,
        errorName: error.name,
        text,
      })

      throw new SearchStageError({
        stage: 'prompt-analysis',
        message:
          'Search analysis could not be processed. Please try your query again.',
        underlyingErrorName: error.name,
        responseText: text,
        details: serializeFailureDetails({
          error: error.message,
          cause:
            error.cause instanceof Error ? error.cause.message : error.cause,
        }),
        cause: error,
      })
    }

    throw error
  }
}

/**
 * Calls the LLM to extract structured job metadata from a single Tavily
 * result. Uses `rawContent` when available, falling back to `content`.
 * Returns `NULL_EXTRACTION` on any failure so the pipeline can continue.
 *
 * @param result - One normalized Tavily search result to extract metadata
 * from.
 * @param userPrompt - Original user prompt used to score query-aware
 * relevance.
 * @param modelId - Optional AI model override for the extraction call.
 * @returns Structured job metadata for the result, or `NULL_EXTRACTION` when
 * extraction fails or produces no usable output.
 */
export async function extractJobDetails(
  result: TavilySingleResult,
  userPrompt: string,
  modelId?: string,
): Promise<JobExtraction> {
  const content = result.rawContent ?? result.content

  try {
    const { output } = await generateText({
      model: getJobSearchModel(modelId),
      maxOutputTokens: 1024,
      system: extractJobDetailsSystem,
      prompt: [
        `User search prompt: ${userPrompt}`,
        '',
        `Page title: ${result.title}`,
        `Page URL: ${result.url}`,
        '',
        'Page content:',
        content,
      ].join('\n'),
      output: Output.object({
        schema: jobExtractionSchema,
      }),
    })

    return output ?? NULL_EXTRACTION
  } catch (error) {
    if (
      NoObjectGeneratedError.isInstance(error) ||
      NoOutputGeneratedError.isInstance(error)
    ) {
      console.warn('Job detail extraction produced no output.', {
        url: result.url,
      })
      return NULL_EXTRACTION
    }

    console.warn('Job detail extraction failed.', {
      url: result.url,
      error: error instanceof Error ? error.message : String(error),
    })
    return NULL_EXTRACTION
  }
}

/**
 * Extracts structured metadata from all Tavily results in parallel.
 * Individual failures are silently replaced with null extractions so the
 * pipeline always gets a complete array.
 *
 * @param results - Normalized Tavily results to enrich.
 * @param userPrompt - Original user prompt reused for per-result relevance
 * extraction.
 * @param modelId - Optional AI model override for all extraction calls.
 * @returns One extraction result per input item, preserving input order and
 * substituting `NULL_EXTRACTION` for failed entries.
 */
export async function extractAllJobDetails(
  results: TavilySearchResult['results'],
  userPrompt: string,
  modelId?: string,
): Promise<JobExtraction[]> {
  const settled = await Promise.allSettled(
    results.map((result) => extractJobDetails(result, userPrompt, modelId)),
  )

  return settled.map((outcome) =>
    outcome.status === 'fulfilled' ? outcome.value : NULL_EXTRACTION,
  )
}

/**
 * Strips common markdown formatting so summaries display as plain text.
 *
 * @param value - Raw markdown-like text from extracted summaries or source
 * snippets.
 * @returns Plain-text content suitable for persistence and UI display.
 */
function stripMarkdown(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Truncates a string without cutting too aggressively through the middle of a
 * word.
 *
 * @param value - Text to shorten.
 * @param maxLength - Target maximum output length before appending `...`.
 * @returns The original text when short enough, otherwise a truncated copy.
 */
function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  const truncated = value.slice(0, maxLength + 1)
  const lastSpaceIndex = truncated.lastIndexOf(' ')
  const cutoff =
    lastSpaceIndex > Math.floor(maxLength * 0.6) ? lastSpaceIndex : maxLength

  return `${truncated.slice(0, cutoff).trimEnd()}...`
}

/**
 * Clamps a numeric score into the UI-friendly 0-100 percentage range.
 *
 * @param value - Raw score or percentage candidate.
 * @returns An integer percentage bounded to 0-100.
 */
function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * Chooses the best available relevance signal for a saved job.
 *
 * @param extraction - Optional LLM extraction payload for the Tavily result.
 * @param result - Original Tavily result whose retrieval score can act as a
 * fallback.
 * @returns A clamped relevance percentage derived from the extraction when
 * available, otherwise from the Tavily retrieval score.
 */
function resolveRelevance(
  extraction: JobExtraction | undefined,
  result: TavilySingleResult,
) {
  if (typeof extraction?.relevance === 'number') {
    return clampPercent(extraction.relevance)
  }

  return clampPercent(result.score * 100)
}

/**
 * Extracts a readable hostname from a URL for use as a fallback source label.
 *
 * @param url - Job posting URL or any URL-like source string.
 * @returns A hostname without `www.` when URL parsing succeeds, otherwise the
 * original input string.
 */
export function sourceFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Extracts a company name from a typical ATS page title.
 * Handles patterns like "Role @ Company - Jobs" or "Role - Company".
 *
 * @param title - Raw page title returned by Tavily.
 * @returns A best-effort company label or `undefined` when no reliable company
 * segment can be inferred.
 */
function extractCompanyFromTitle(title: string): string | undefined {
  const atMatch = title.match(/@\s*(.+?)(?:\s*[-–—]\s*(?:Jobs?|Careers?))?$/i)
  if (atMatch?.[1]?.trim()) return atMatch[1].trim()

  const segments = title.split(/\s*[-–—|]\s*/).filter(Boolean)
  if (segments.length >= 2) {
    for (let i = segments.length - 1; i >= 1; i--) {
      if (/^(jobs?|careers?|hiring|apply)$/i.test(segments[i]!)) continue
      return segments[i]!.trim()
    }
  }

  return undefined
}

/**
 * Cleans a Tavily page title into a job title by stripping the company
 * and trailing noise like "- Jobs", "| Careers", etc.
 *
 * @param title - Raw page title returned by Tavily.
 * @returns A simplified job-title string with common ATS suffix noise removed.
 */
function cleanJobTitle(title: string): string {
  return title
    .replace(/\s*[@]\s*.+$/, '')
    .replace(/\s*[-–—|]\s*(jobs?|careers?|hiring|apply).*$/i, '')
    .replace(/\s*[-–—|]\s*[^-–—|]+$/, '')
    .trim()
}

/**
 * Maps raw Tavily search results directly to the DB-ready job shape.
 * When `extractions` is provided, extracted values override heuristic defaults.
 *
 * @param results - Normalized Tavily results to convert into saved jobs.
 * @param extractions - Optional per-result extraction payloads aligned by array
 * index.
 * @param availabilityChecks - Optional availability results aligned by array
 * index. When present, their timestamps are persisted on the matching jobs.
 * @returns Ranked, deduplicated, persistence-ready job records capped to
 * `MAX_SAVED_JOB_RESULTS`.
 */
export function tavilyResultsToJobs(
  results: TavilySearchResult['results'],
  extractions?: JobExtraction[],
  availabilityChecks?: readonly JobAvailabilityCheck[],
) {
  const seenUrls = new Set<string>()

  return results
    .map((result, index) => ({
      extraction: extractions?.[index],
      originalIndex: index,
      result,
    }))
    .filter(({ result }) => {
      if (seenUrls.has(result.url)) return false
      seenUrls.add(result.url)
      return true
    })
    .map(({ extraction, originalIndex, result }) => {
      const title = cleanJobTitle(result.title) || result.title.trim()
      const company =
        extraction?.company ??
        extractCompanyFromTitle(result.title) ??
        sourceFromUrl(result.url)
      const favicon = result.favicon?.trim()
      const matchScore = clampPercent(result.score * 100)
      const summary = stripMarkdown(
        extraction?.summary ??
          truncateText(
            result.content.replace(/\s+/g, ' ').trim(),
            MAX_JOB_SUMMARY_LENGTH,
          ),
      )

      return {
        matchScore,
        originalIndex,
        relevance: resolveRelevance(extraction, result),
        title,
        company,
        location: extraction?.location ?? ('Unspecified' as const),
        summary,
        url: result.url,
        ...(favicon ? { favicon } : {}),
        source: extraction?.source ?? sourceFromUrl(result.url),
        category: extraction?.category ?? ('other' as const),
        workArrangement: 'unspecified' as const,
        employmentType: extraction?.employmentType ?? ('unspecified' as const),
        tags: extraction?.tags ?? ([] as string[]),
        availabilityCheckedAt: availabilityChecks?.[originalIndex]?.checkedAt,
      }
    })
    .sort((a, b) => {
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance
      }

      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore
      }

      return a.originalIndex - b.originalIndex
    })
    .slice(0, MAX_SAVED_JOB_RESULTS)
    .map(({ originalIndex: _originalIndex, ...job }, index) => ({
      ...job,
      rank: index + 1,
    }))
}

/**
 * Normalizes and ranks the raw Tavily result items for persistence.
 *
 * @param results - Normalized Tavily results in original retrieval order.
 * @returns Persistable raw-result rows with stable rank values and trimmed text
 * fields.
 */
export function normalizeRawSearchResults(
  results: TavilySearchResult['results'],
) {
  return results.map((result, index) => ({
    rank: index + 1,
    title: result.title.trim(),
    url: result.url,
    content: result.content.trim(),
    score: result.score,
    ...(result.rawContent ? { rawContent: result.rawContent } : {}),
  }))
}

/**
 * Builds the persisted human-readable summary for a completed job search.
 *
 * @param jobCount - Number of saved jobs that survived extraction and
 * filtering.
 * @returns A human-readable summary sentence shown on completed search runs.
 */
export function buildJobSearchSummary(jobCount: number) {
  return jobCount > 0
    ? `Found ${jobCount} job opening${jobCount === 1 ? '' : 's'} from job board search results.`
    : 'No job openings were found for this search.'
}

export type JobAvailabilityCheck = {
  status: 'available' | 'unavailable' | 'unknown'
  checkedAt: number
  reason?: string
}

/**
 * Collapses repeated whitespace so title and body comparisons use a consistent
 * text shape.
 *
 * @param value - Raw text extracted from HTML or response bodies.
 * @returns A trimmed string with repeated whitespace condensed to single
 * spaces.
 */
function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Decodes a small set of common HTML entities found on ATS pages.
 *
 * @param value - Raw HTML-derived string.
 * @returns A string with frequently encountered entities converted back to
 * human-readable characters.
 */
function decodeCommonEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

/**
 * Extracts a normalized document title from raw HTML for availability checks.
 *
 * @param html - Raw HTML response body.
 * @returns The decoded `<title>` text, or an empty string when no title is
 * present.
 */
function extractPageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match?.[1]) return ''

  return normalizeWhitespace(
    decodeCommonEntities(match[1]).replace(/<[^>]+>/g, ' '),
  )
}

/**
 * Removes markup and non-visible content from an HTML page before pattern
 * matching.
 *
 * @param html - Raw HTML response body.
 * @returns A plain-text approximation of the page contents for availability
 * heuristics.
 */
function stripHtmlToText(html: string) {
  return normalizeWhitespace(
    decodeCommonEntities(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  )
}

/**
 * Checks whether one hostname exactly matches, or is a subdomain of, an
 * expected provider host.
 *
 * @param hostname - Parsed hostname from the visited job URL.
 * @param expectedHost - Canonical provider host from the allowlist.
 * @returns `true` when the hostname belongs to the expected host family.
 */
function hostnameMatches(hostname: string, expectedHost: string) {
  return hostname === expectedHost || hostname.endsWith(`.${expectedHost}`)
}

/**
 * Returns host-specific unavailable markers for the given hostname.
 *
 * @param hostname - Parsed hostname from the visited job URL.
 * @returns Regex patterns tailored to the ATS host, in addition to the generic
 * unavailable markers used everywhere.
 */
function getUnavailablePatternsForHost(hostname: string) {
  return HOST_UNAVAILABLE_PATTERNS.flatMap((entry) =>
    hostnameMatches(hostname, entry.host) ? entry.patterns : [],
  )
}

/**
 * Parses a lowercase hostname from a URL string.
 *
 * @param url - URL to inspect.
 * @returns A lowercase hostname, or an empty string when URL parsing fails.
 */
function parseHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Tests whether the visited page text contains a known unavailable marker.
 *
 * @param text - Combined normalized page title and body text.
 * @param hostname - Parsed hostname for host-specific rules.
 * @returns `true` when the content strongly suggests the posting is no longer
 * available.
 */
function hasUnavailableMarker(text: string, hostname: string) {
  return [
    ...GENERIC_UNAVAILABLE_PATTERNS,
    ...getUnavailablePatternsForHost(hostname),
  ].some((pattern) => pattern.test(text))
}

/**
 * Determines whether a saved job posting should be revalidated.
 *
 * @param availabilityCheckedAt - Optional timestamp from the last direct URL
 * check. Missing values always force a recheck.
 * @param now - Optional current timestamp override, mainly useful for tests.
 * @returns `true` when the posting has never been checked or the last check is
 * older than the configured recheck interval.
 */
export function shouldRecheckJobPosting(
  availabilityCheckedAt?: number,
  now = Date.now(),
) {
  if (availabilityCheckedAt === undefined) {
    return true
  }

  return now - availabilityCheckedAt >= JOB_AVAILABILITY_RECHECK_INTERVAL_MS
}

/**
 * Fetches a job URL directly and classifies whether the posting still looks
 * live. Only clear removals/closures are treated as unavailable.
 *
 * @param url - Direct job posting URL to inspect.
 * @returns An availability classification containing the status, check time,
 * and optional reason. Ambiguous fetch failures return `unknown` instead of
 * deleting the posting.
 */
export async function checkJobPostingAvailability(
  url: string,
): Promise<JobAvailabilityCheck> {
  const checkedAt = Date.now()

  let response: Response

  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(JOB_AVAILABILITY_CHECK_TIMEOUT_MS),
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (compatible; AmarisBot/1.0; +https://amaris.app)',
      },
    })
  } catch (error) {
    return {
      status: 'unknown',
      checkedAt,
      reason: error instanceof Error ? error.message : String(error),
    }
  }

  if ([404, 410, 451].includes(response.status)) {
    return {
      status: 'unavailable',
      checkedAt,
      reason: `HTTP ${response.status}`,
    }
  }

  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 429 ||
    response.status >= 500
  ) {
    return {
      status: 'unknown',
      checkedAt,
      reason: `HTTP ${response.status}`,
    }
  }

  let body: string

  try {
    body = await response.text()
  } catch (error) {
    return {
      status: 'unknown',
      checkedAt,
      reason: error instanceof Error ? error.message : String(error),
    }
  }

  const finalUrl = response.url || url
  const hostname = parseHostname(finalUrl)
  const title = extractPageTitle(body)
  const text = stripHtmlToText(body).slice(0, 50_000)
  const combinedText = normalizeWhitespace(`${title} ${text}`)

  if (hasUnavailableMarker(combinedText, hostname)) {
    return {
      status: 'unavailable',
      checkedAt,
      reason: 'Page content indicates the posting is no longer available.',
    }
  }

  return {
    status: 'available',
    checkedAt,
  }
}

/**
 * Runs direct availability checks for a batch of job URLs in parallel.
 *
 * @param items - URL-bearing items to inspect. Only the `url` field is used.
 * @returns One availability result per input item, preserving input order.
 */
export async function checkJobPostingAvailabilityBatch(
  items: readonly { url: string }[],
) {
  return await Promise.all(
    items.map((item) => checkJobPostingAvailability(item.url)),
  )
}

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

  const extractions = await extractAllJobDetails(liveResults, prompt, modelId)

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
    await ctx.runMutation(internal.search.mutations.saveSearchOutcome, {
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

/**
 * Loads the saved jobs for a single search run using the rank index.
 *
 * @param ctx - Read context used to query the `jobResults` table.
 * @param searchRunId - The search run whose jobs should be loaded.
 * @returns The bounded list of saved jobs for the search run.
 */
export async function getSavedJobsForSearchRun(
  ctx: SearchReadCtx,
  searchRunId: Id<'searchRuns'>,
) {
  return await ctx.db
    .query('jobResults')
    .withIndex('by_searchRunId_rank', (q) => q.eq('searchRunId', searchRunId))
    .take(MAX_SAVED_JOB_RESULTS)
}

/**
 * Chooses the best match percentage field for admin/result sorting.
 *
 * @param job - Saved job result carrying optional relevance and match score
 * fields.
 * @returns Relevance when available, otherwise the fallback match score, or
 * zero when neither field is present.
 */
export function resolveJobMatchPercentage(job: {
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
export function resolveAdminSearchLimit(requestedLimit: number | undefined) {
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
export function queryAdminSearchRunsByCreatedAt(
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
