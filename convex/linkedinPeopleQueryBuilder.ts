import {
  LINKEDIN_COMPANY_TERM_MAX_LENGTH,
  LINKEDIN_PEOPLE_PRIORITY_TERMS,
  LINKEDIN_ROLE_TERM_MAX_LENGTH,
} from './searchConstants'

/**
 * Removes search operators and punctuation that would make a LinkedIn-focused
 * query brittle or harder to control.
 *
 * @param value - The raw company or role term.
 * @returns A sanitized term safe for deterministic query construction.
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
 * @returns The shortened term.
 */
function shorten(value: string, maxLength: number) {
  return value.slice(0, maxLength).trim()
}

/**
 * Builds a deterministic LinkedIn people lookup query for a company and target
 * job title.
 *
 * @param input - The company and role context for the lookup.
 * @param input.company - The company name attached to the job result.
 * @param input.jobTitle - The target role title attached to the job result.
 * @returns A LinkedIn-focused Tavily query string.
 */
export function buildLinkedInPeopleSearchQuery({
  company,
  jobTitle,
}: {
  company: string
  jobTitle: string
}) {
  const companyTerm = shorten(
    sanitizeQueryTerm(company),
    LINKEDIN_COMPANY_TERM_MAX_LENGTH,
  )
  const roleTerm = shorten(
    sanitizeQueryTerm(jobTitle),
    LINKEDIN_ROLE_TERM_MAX_LENGTH,
  )
  const peopleClauses: string[] = [...LINKEDIN_PEOPLE_PRIORITY_TERMS]

  if (roleTerm) {
    peopleClauses.push(roleTerm)
  }

  return [
    '(site:linkedin.com/in OR site:linkedin.com/pub)',
    `"${companyTerm}"`,
    `(${peopleClauses.map((value) => `"${value}"`).join(' OR ')})`,
  ].join(' AND ')
}
