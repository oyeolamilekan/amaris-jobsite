import { MAX_SAVED_JOB_RESULTS } from '../shared/constants'
import type { JobExtraction } from '../shared/schemas'
import type { TavilySearchResult } from '../shared/tavily'

const MAX_JOB_SUMMARY_LENGTH = 500

/**
 * Strips common markdown formatting so summaries display as plain text.
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
 * Extracts a readable hostname from a URL for use as a fallback source label.
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
 */
export function tavilyResultsToJobs(
  results: TavilySearchResult['results'],
  extractions?: JobExtraction[],
) {
  const seenUrls = new Set<string>()

  return results
    .filter((result) => {
      if (seenUrls.has(result.url)) return false
      seenUrls.add(result.url)
      return true
    })
    .slice(0, MAX_SAVED_JOB_RESULTS)
    .map((result, index) => {
      const extraction = extractions?.[index]

      const title = cleanJobTitle(result.title) || result.title.trim()
      const company =
        extraction?.company ??
        extractCompanyFromTitle(result.title) ??
        sourceFromUrl(result.url)
      const summary =
        stripMarkdown(
          extraction?.summary ??
            truncateText(
              result.content.replace(/\s+/g, ' ').trim(),
              MAX_JOB_SUMMARY_LENGTH,
            ),
        )

      return {
        rank: index + 1,
        title,
        company,
        location: extraction?.location ?? ('Unspecified' as const),
        summary,
        url: result.url,
        source: extraction?.source ?? sourceFromUrl(result.url),
        category: extraction?.category ?? ('other' as const),
        workArrangement: 'unspecified' as const,
        employmentType: extraction?.employmentType ?? ('unspecified' as const),
        tags: extraction?.tags ?? ([] as string[]),
        matchScore: Math.round(result.score * 100),
      }
    })
}

/**
 * Normalizes and ranks the raw Tavily result items for persistence.
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
