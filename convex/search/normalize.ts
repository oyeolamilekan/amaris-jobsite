import { MAX_SAVED_JOB_RESULTS } from '../shared/constants'
import type { JobExtraction } from '../shared/schemas'
import type { TavilySearchResult } from '../shared/tavily'
import type { JobAvailabilityCheck } from './availability'

const MAX_JOB_SUMMARY_LENGTH = 500
type TavilySingleResult = TavilySearchResult['results'][number]

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
      const summary =
        stripMarkdown(
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
