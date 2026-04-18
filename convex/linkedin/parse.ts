import type { StructuredLinkedInPerson } from '../shared/schemas'
import type { TavilySearchResult } from '../shared/tavily'

const LINKEDIN_TITLE_SUFFIX = /\s*[\|–—-]\s*LinkedIn\s*$/i
const TITLE_SEPARATOR = /\s*[\|–—-]\s*/

/**
 * Parses a LinkedIn search result title into a name and headline.
 *
 * @param title - Raw Tavily result title for a LinkedIn profile-like page.
 *
 * Common formats:
 *   "Jane Doe - Senior Engineer at Acme | LinkedIn"
 *   "Jane Doe – Acme Corp | LinkedIn"
 *   "Jane Doe - Acme Corp - LinkedIn"
 * @returns Parsed name/headline fields, omitting either field when it cannot
 * be confidently extracted.
 */
function parseLinkedInTitle(title: string): {
  name: string | undefined
  headline: string | undefined
} {
  const cleaned = title.replace(LINKEDIN_TITLE_SUFFIX, '').trim()
  if (!cleaned) return { name: undefined, headline: undefined }

  const firstDash = cleaned.search(/\s+[-–—]\s+/)
  if (firstDash === -1) {
    return { name: cleaned, headline: undefined }
  }

  const name = cleaned.slice(0, firstDash).trim()
  const headline = cleaned
    .slice(firstDash)
    .replace(/^\s*[-–—]\s*/, '')
    .replace(TITLE_SEPARATOR, ' | ')
    .trim()

  return {
    name: name || undefined,
    headline: headline || undefined,
  }
}

const LOCATION_PATTERN =
  /(?:^|\.\s+|,\s+|\s{2,})([A-Z][a-zA-Z\u00C0-\u024F\s]+(?:,\s*[A-Z][a-zA-Z\u00C0-\u024F\s]+)+)/

/**
 * Attempts to extract a location from LinkedIn content. Looks for patterns
 * like "City, State" or "City, Country".
 *
 * @param content - Flattened page content assembled from Tavily snippets and
 * raw content.
 * @returns A location string when one can be safely inferred, otherwise
 * `undefined`.
 */
function extractLocation(content: string): string | undefined {
  const match = content.match(LOCATION_PATTERN)
  if (!match) return undefined

  const candidate = match[1].trim()
  const lower = candidate.toLowerCase()
  const skipWords = [
    'about',
    'experience',
    'education',
    'skills',
    'linkedin',
    'privacy',
    'cookie',
    'user agreement',
  ]
  if (skipWords.some((w) => lower.includes(w))) return undefined
  if (candidate.length > 60) return undefined

  return candidate
}

/**
 * Parses Tavily results into structured LinkedIn people using deterministic
 * title parsing and content extraction — no LLM calls needed.
 *
 * @param tavilyResults - The raw Tavily response to structure.
 * @returns Structured LinkedIn people results ready for normalization,
 * including a summary string and LinkedIn profile URLs copied from Tavily.
 */
export function structureLinkedInPeopleResults(
  tavilyResults: TavilySearchResult,
): {
  summary: string
  people: (StructuredLinkedInPerson & { linkedinUrl: string })[]
} {
  const people = tavilyResults.results
    .map((result) => {
      const { name, headline } = parseLinkedInTitle(result.title)
      if (!name) return null

      const content = [result.content, result.rawContent ?? '']
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      const location = extractLocation(content)

      return {
        name,
        headline,
        linkedinUrl: result.url,
        ...(location ? { location } : {}),
      }
    })
    .filter(
      (p): p is NonNullable<typeof p> => p !== null,
    )

  return {
    summary:
      people.length > 0
        ? `Found ${people.length} LinkedIn profile${people.length === 1 ? '' : 's'}.`
        : 'No credible LinkedIn profiles found.',
    people,
  }
}
