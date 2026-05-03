import type { QueryCtx } from '../_generated/server'
import type { LinkedInPeopleSearchMode } from '../shared/constants'
import {
  LINKEDIN_COMPANY_TERM_MAX_LENGTH,
  LINKEDIN_PEOPLE_PRIORITY_TERMS,
  LINKEDIN_ROLE_TERM_MAX_LENGTH,
  MAX_LINKEDIN_PEOPLE_RESULTS,
} from '../shared/constants'
import type { StructuredLinkedInPerson } from '../shared/schemas'
import type { TavilySearchResult } from '../shared/tavily'
import {
  LINKEDIN_TITLE_SUFFIX,
  LOCATION_PATTERN,
  MAX_ADMIN_LINKEDIN_LIMIT,
  TITLE_SEPARATOR,
} from './constants'

/**
 * Builds the base LinkedIn-search query used by the admin views, with an
 * optional lower bound on `createdAt`.
 *
 * @param ctx - Query context used to create the indexed
 * `linkedinPeopleSearches` query.
 * @param sinceTimestamp - Optional Unix-millisecond lower bound for
 * `createdAt`. When omitted, the query spans all saved LinkedIn searches.
 * @returns An indexed Convex query scoped for the requested time window.
 */
export function queryAdminLinkedInSearchesByCreatedAt(
  ctx: QueryCtx,
  sinceTimestamp: number | undefined,
) {
  if (sinceTimestamp === undefined) {
    return ctx.db.query('linkedinPeopleSearches').withIndex('by_createdAt')
  }

  return ctx.db
    .query('linkedinPeopleSearches')
    .withIndex('by_createdAt', (q) => q.gte('createdAt', sinceTimestamp))
}

/**
 * Clamps the admin LinkedIn page size to a safe bounded range.
 *
 * @param requestedLimit - Requested `paginationOpts.numItems` value.
 * @returns A value constrained to the supported admin LinkedIn page size range.
 */
export function resolveAdminLinkedInLimit(requestedLimit: number) {
  return Math.min(Math.max(requestedLimit, 1), MAX_ADMIN_LINKEDIN_LIMIT)
}

/**
 * Removes search operators and punctuation that would make a LinkedIn-focused
 * query brittle or harder to control.
 *
 * @param value - The raw company or role term.
 * @returns A sanitized term safe for deterministic query construction, with
 * explicit search operators and brittle punctuation removed.
 */
function sanitizeQueryTerm(value: string) {
  return value
    .replace(/site:\S+/gi, ' ')
    .replace(/\b(AND|OR|NOT)\b/gi, ' ')
    .replace(/[()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Truncates a query term to the configured maximum length.
 *
 * @param value - The query term to shorten.
 * @param maxLength - The maximum allowed term length.
 * @returns The shortened term after a simple hard cutoff and trim.
 */
function shorten(value: string, maxLength: number) {
  return value.slice(0, maxLength).trim()
}

function normalizeLinkedInProfileUrl(value: string): string | undefined {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    return undefined
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  if (!hostname.endsWith('linkedin.com')) return undefined

  const segments = url.pathname.split('/').filter(Boolean)
  const profileSegmentIndex = segments.findIndex((segment) => segment === 'in')
  const slug = segments[profileSegmentIndex + 1]
  if (profileSegmentIndex === -1 || !slug) return undefined

  return `https://www.linkedin.com/in/${slug}`
}

function buildRoleTerms(jobTitle?: string) {
  if (!jobTitle) return []

  const roleTerm = shorten(
    sanitizeQueryTerm(jobTitle),
    LINKEDIN_ROLE_TERM_MAX_LENGTH,
  )
  if (!roleTerm) return []

  const lowerRole = roleTerm.toLowerCase()
  const roleFamilies = [
    ['engineer', 'engineering manager'],
    ['developer', 'engineering manager'],
    ['designer', 'design manager'],
    ['product', 'product manager'],
    ['data', 'data manager'],
    ['sales', 'sales manager'],
    ['marketing', 'marketing manager'],
    ['customer', 'customer success manager'],
    ['finance', 'finance manager'],
    ['recruit', 'recruiter'],
  ] as const
  const familyTerms = roleFamilies
    .filter(([needle]) => lowerRole.includes(needle))
    .map(([, term]) => term)

  return Array.from(new Set([roleTerm, ...familyTerms]))
}

function scoreLinkedInResult(input: {
  title: string
  content: string
  company: string | undefined
  jobTitle: string | undefined
  tavilyScore: number
}) {
  const haystack = `${input.title} ${input.content}`.toLowerCase()
  let score = input.tavilyScore

  if (input.company) {
    const companyTerm = sanitizeQueryTerm(input.company).toLowerCase()
    if (companyTerm && haystack.includes(companyTerm)) score += 2
    if (companyTerm && haystack.includes(` at ${companyTerm}`)) score += 3
  }

  const priorityTerms = [
    ...LINKEDIN_PEOPLE_PRIORITY_TERMS,
    ...buildRoleTerms(input.jobTitle),
  ]
  for (const term of priorityTerms) {
    if (haystack.includes(term.toLowerCase())) score += 1
  }

  if (/\b(profile|experience|connections?)\b/i.test(haystack)) score += 0.5
  if (/\b(job|jobs|careers|salary|internship)\b/i.test(input.title)) score -= 2

  return score
}

/**
 * Builds a deterministic LinkedIn people lookup query for a company, focused
 * on recruiter profiles and optional location biasing.
 *
 * @param input - The company context for the lookup.
 * @param input.company - The company name attached to the job result.
 * @param input.jobTitle - Optional role title used to find adjacent hiring
 * managers and team members.
 * @param input.location - Optional job location used to bias the query.
 * @returns A LinkedIn-focused Tavily query string.
 */
export function buildLinkedInPeopleSearchQuery({
  company,
  jobTitle,
  location,
  mode,
}: {
  company: string
  jobTitle?: string
  location?: string
  mode: LinkedInPeopleSearchMode
}) {
  const companyTerm = shorten(
    sanitizeQueryTerm(company),
    LINKEDIN_COMPANY_TERM_MAX_LENGTH,
  )

  if (mode === 'all') {
    return ['site:linkedin.com/in', `"${companyTerm}"`]
      .filter(Boolean)
      .join(' ')
  }

  const recruiterClauses = LINKEDIN_PEOPLE_PRIORITY_TERMS.map(
    (term) => `"${term}"`,
  ).join(' OR ')
  const roleClauses = buildRoleTerms(jobTitle)
    .map((term) => `"${term}"`)
    .join(' OR ')
  const companyContext = [
    `"${companyTerm}"`,
    `("at ${companyTerm}" OR "@ ${companyTerm}" OR "${companyTerm} people")`,
  ].join(' AND ')
  const locationTerm = location ? sanitizeQueryTerm(location) : ''
  const locationClause =
    locationTerm && !/^remote|unspecified$/i.test(locationTerm)
      ? `"${shorten(locationTerm, LINKEDIN_ROLE_TERM_MAX_LENGTH)}"`
      : ''
  const peopleClauses = roleClauses
    ? `(${recruiterClauses} OR ${roleClauses})`
    : `(${recruiterClauses})`
  const exclusionClause = ['-jobs', '-job', '-careers', '-internship'].join(' ')

  return [
    'site:linkedin.com/in',
    companyContext,
    peopleClauses,
    locationClause,
    exclusionClause,
  ]
    .filter(Boolean)
    .join(' AND ')
}

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
  context?: { company?: string; jobTitle?: string },
): {
  summary: string
  people: (StructuredLinkedInPerson & { linkedinUrl: string })[]
} {
  const people = tavilyResults.results
    .map((result) => {
      const linkedinUrl = normalizeLinkedInProfileUrl(result.url)
      if (!linkedinUrl) return null

      const { name, headline } = parseLinkedInTitle(result.title)
      if (!name) return null

      const content = [result.content, result.rawContent ?? '']
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      const score = scoreLinkedInResult({
        title: result.title,
        content,
        company: context?.company,
        jobTitle: context?.jobTitle,
        tavilyScore: result.score,
      })
      const location = extractLocation(content)

      return {
        name,
        headline,
        linkedinUrl,
        score,
        ...(location ? { location } : {}),
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...person }) => person)

  return {
    summary:
      people.length > 0
        ? `Found ${people.length} LinkedIn profile${people.length === 1 ? '' : 's'}.`
        : 'No credible LinkedIn profiles found.',
    people,
  }
}

/**
 * Deduplicates and ranks structured LinkedIn people results before they are
 * persisted for a job.
 *
 * @param people - Structured LinkedIn people candidates from the AI layer.
 * @returns Persistable LinkedIn people results with stable ranking, duplicate
 * profile URLs removed, and the list capped to
 * `MAX_LINKEDIN_PEOPLE_RESULTS`.
 */
export function normalizeLinkedInPeople(
  people: Array<{
    name?: string
    headline?: string
    linkedinUrl: string
    location?: string
  }>,
) {
  const seenUrls = new Set<string>()
  const seenNames = new Set<string>()

  return people
    .filter((person) => {
      const linkedinUrl = normalizeLinkedInProfileUrl(person.linkedinUrl)
      if (!linkedinUrl || seenUrls.has(linkedinUrl)) return false

      const nameKey = person.name?.trim().toLowerCase()
      if (nameKey && seenNames.has(nameKey)) return false

      person.linkedinUrl = linkedinUrl
      seenUrls.add(linkedinUrl)
      if (nameKey) seenNames.add(nameKey)
      return true
    })
    .slice(0, MAX_LINKEDIN_PEOPLE_RESULTS)
    .map((person, index) => {
      const normalizedPerson: {
        rank: number
        name?: string
        headline?: string
        linkedinUrl: string
        location?: string
      } = { rank: index + 1, linkedinUrl: person.linkedinUrl }

      if (person.name) normalizedPerson.name = person.name.trim()
      if (person.headline) normalizedPerson.headline = person.headline.trim()
      if (person.location?.trim())
        normalizedPerson.location = person.location.trim()

      return normalizedPerson
    })
}
