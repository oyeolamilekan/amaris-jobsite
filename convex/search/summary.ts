/**
 * Builds the persisted human-readable summary for a completed job search.
 */
export function buildJobSearchSummary(jobCount: number) {
  return jobCount > 0
    ? `Found ${jobCount} job opening${jobCount === 1 ? '' : 's'} from job board search results.`
    : 'No job openings were found for this search.'
}
