import { MAX_LINKEDIN_PEOPLE_RESULTS } from './searchConstants'
import type { StructuredLinkedInPerson } from './searchSchemas'

/**
 * Deduplicates and ranks structured LinkedIn people results before they are
 * persisted for a job.
 *
 * @param people - Structured LinkedIn people candidates from the AI layer.
 * @returns Persistable LinkedIn people results with stable ranking.
 */
export function normalizeLinkedInPeople(people: StructuredLinkedInPerson[]) {
  const seenUrls = new Set<string>()

  return people
    .filter((person) => {
      if (seenUrls.has(person.linkedinUrl)) {
        return false
      }

      seenUrls.add(person.linkedinUrl)
      return true
    })
    .slice(0, MAX_LINKEDIN_PEOPLE_RESULTS)
    .map((person, index) => {
      const normalizedPerson = {
        rank: index + 1,
        name: person.name.trim(),
        headline: person.headline.trim(),
        linkedinUrl: person.linkedinUrl,
        reason: person.reason.trim(),
      }

      if (person.location?.trim()) {
        return {
          ...normalizedPerson,
          location: person.location.trim(),
        }
      }

      return normalizedPerson
    })
}
