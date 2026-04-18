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
