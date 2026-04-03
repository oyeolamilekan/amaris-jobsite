import { gateway } from 'ai'
import { AVAILABLE_AI_MODELS, JOB_SEARCH_MODEL } from './constants'

type AiModelId = (typeof AVAILABLE_AI_MODELS)[number]['id']

const AVAILABLE_AI_MODEL_IDS = new Set<string>(
  AVAILABLE_AI_MODELS.map((model) => model.id),
)

export function isAvailableAiModelId(modelId: string): modelId is AiModelId {
  return AVAILABLE_AI_MODEL_IDS.has(modelId)
}

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
