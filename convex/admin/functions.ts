import { JOB_SEARCH_MODEL } from '../shared/constants'
import { resolveAiModelId } from '../shared/model'

/**
 * Resolves the effective admin-configured AI model, falling back to the app
 * default when no settings document exists yet.
 *
 * @param aiModel - Optional persisted model id from `adminSettings`.
 * @returns A supported AI model id that can be used safely by callers.
 */
export function resolveAdminSettingsAiModel(aiModel?: string) {
  return resolveAiModelId(aiModel ?? JOB_SEARCH_MODEL)
}
