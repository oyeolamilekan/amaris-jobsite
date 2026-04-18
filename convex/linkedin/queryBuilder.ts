import {
  LINKEDIN_COMPANY_TERM_MAX_LENGTH,
  LINKEDIN_PEOPLE_PRIORITY_TERMS,
} from '../shared/constants'

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

/**
 * Builds a deterministic LinkedIn people lookup query for a company, focused
 * on recruiter profiles and optional location biasing.
 *
 * @param input - The company context for the lookup.
 * @param input.company - The company name attached to the job result.
 * @param input.location - Optional job location used to bias the query.
 * @returns A LinkedIn-focused Tavily query string.
 */
export function buildLinkedInPeopleSearchQuery({
  company,
  location,
}: {
  company: string
  location?: string
}) {
  const companyTerm = shorten(
    sanitizeQueryTerm(company),
    LINKEDIN_COMPANY_TERM_MAX_LENGTH,
  )
  const recruiterClauses = LINKEDIN_PEOPLE_PRIORITY_TERMS.map(
    (term) => `"${term}"`,
  ).join(' OR ')
  const companyContext = [
    `"${companyTerm}"`,
    `("at ${companyTerm}" OR "@ ${companyTerm}")`,
  ].join(' AND ')
  const locationTerm = location ? sanitizeQueryTerm(location) : ''
  const locationClause = locationTerm
    ? `("${locationTerm}" OR "EU" OR "Europe") -India -Bangalore -USA`
    : ''
  const exclusionClause = ['-jobs', '-hiring', '-intern'].join(' ')

  return [
    'site:linkedin.com/in',
    companyContext,
    `(${recruiterClauses})`,
    locationClause,
    exclusionClause,
  ]
    .filter(Boolean)
    .join(' AND ')
}
