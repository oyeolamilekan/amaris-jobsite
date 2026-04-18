import { gateway } from 'ai'
import { AVAILABLE_AI_MODELS, JOB_SEARCH_MODEL } from './constants'

type AiModelId = (typeof AVAILABLE_AI_MODELS)[number]['id']

const AVAILABLE_AI_MODEL_IDS = new Set<string>(
  AVAILABLE_AI_MODELS.map((model) => model.id),
)

/**
 * Checks whether a raw model id is one of the model ids this app allows in
 * admin settings and search execution.
 *
 * @param modelId - Raw model id from persisted settings or user input.
 * @returns `true` when the id matches one of `AVAILABLE_AI_MODELS`.
 */
export function isAvailableAiModelId(modelId: string): modelId is AiModelId {
  return AVAILABLE_AI_MODEL_IDS.has(modelId)
}

/**
 * Resolves an optional model id to a supported AI Gateway model id, falling
 * back to the app default when the input is missing or unsupported.
 *
 * @param modelId - Optional model id override from admin settings or helper
 * callers.
 * @returns A valid model id that can safely be passed to `gateway(...)`.
 */
export function resolveAiModelId(modelId?: string): AiModelId {
  if (modelId && isAvailableAiModelId(modelId)) {
    return modelId
  }

  return JOB_SEARCH_MODEL
}

/**
 * Returns the AI Gateway model handle for the given identifier, or the
 * default model when no override is provided.
 *
 * @param modelId - Optional model identifier override from admin settings.
 * @returns The configured AI Gateway model instance.
 */
export function getJobSearchModel(modelId?: string) {
  return gateway(resolveAiModelId(modelId))
}
