import { gateway } from 'ai'
import { JOB_SEARCH_MODEL } from './constants'

/**
 * Returns the shared AI Gateway model handle used by the app's enrichment
 * flows.
 *
 * @returns The configured AI Gateway model instance.
 */
export function getJobSearchModel() {
  return gateway(JOB_SEARCH_MODEL)
}
