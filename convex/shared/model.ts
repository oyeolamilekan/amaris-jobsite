import { gateway } from 'ai'
import { JOB_SEARCH_MODEL } from './constants'

/**
 * Returns the AI Gateway model handle for the given identifier, or the
 * default model when no override is provided.
 *
 * @param modelId - Optional model identifier override from admin settings.
 * @returns The configured AI Gateway model instance.
 */
export function getJobSearchModel(modelId?: string) {
  return gateway(modelId ?? JOB_SEARCH_MODEL)
}
