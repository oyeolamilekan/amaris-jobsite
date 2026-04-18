import { MAX_LINKEDIN_PEOPLE_RESULTS } from '../shared/constants'

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

  return people
    .filter((person) => {
      if (seenUrls.has(person.linkedinUrl)) return false
      seenUrls.add(person.linkedinUrl)
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
