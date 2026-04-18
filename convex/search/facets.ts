import {
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  generateText,
} from 'ai'
import { SearchStageError, serializeFailureDetails } from '../shared/failure'
import { getJobSearchModel } from '../shared/model'
import { generateSearchQuerySystem } from '../shared/prompts'
import { searchQuerySchema } from '../shared/schemas'

/**
 * Normalizes the raw intent string into one of the two supported values.
 *
 * @param value - Raw intent text returned by the model.
 * @returns Either `job_search` or `not_job_search`. Unknown or ambiguous
 * labels intentionally fall back to `not_job_search` so the pipeline stays
 * conservative.
 */
function normalizeIntent(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (normalized.includes('not')) return 'not_job_search' as const
  if (normalized.includes('job')) return 'job_search' as const
  return 'not_job_search' as const
}

/**
 * Calls the LLM to classify the user prompt and generate a Tavily Boolean
 * query. Domain scoping is applied when Tavily is called.
 *
 * @param prompt - Raw user prompt to classify and convert into a Tavily query.
 * @param modelId - Optional AI Gateway model id override. When omitted, the
 * configured default model is used.
 * @returns An object containing a normalized `intent` label and a trimmed
 * Tavily query string. Non-job-search responses intentionally return an empty
 * query string.
 */
export async function generateSearchQuery(prompt: string, modelId?: string) {
  try {
    const { output } = await generateText({
      model: getJobSearchModel(modelId),
      maxOutputTokens: 2048,
      system: generateSearchQuerySystem,
      prompt: `User prompt: ${prompt}`,
      output: Output.object({
        schema: searchQuerySchema,
      }),
    })

    if (!output) {
      throw new SearchStageError({
        stage: 'prompt-analysis',
        message:
          'Search analysis returned an empty response. Please try your query again.',
        underlyingErrorName: 'EmptyOutput',
      })
    }

    console.log(output)

    return {
      intent: normalizeIntent(output.intent),
      query: output.query?.trim() || '',
    }
  } catch (error) {
    if (error instanceof SearchStageError) throw error

    if (error instanceof Error && error.name === 'GatewayAuthenticationError') {
      const text = 'text' in error ? (error.text as string) : undefined

      console.error('Search query generation could not authenticate with AI Gateway.', {
        prompt,
        error: error.message,
        text,
      })

      throw new SearchStageError({
        stage: 'runtime-config',
        message:
          'AI Gateway authentication failed. Check AI_GATEWAY_API_KEY in the runtime environment.',
        underlyingErrorName: error.name,
        responseText: text,
        details: serializeFailureDetails({
          error: error.message,
          cause:
            error.cause instanceof Error ? error.cause.message : error.cause,
        }),
        cause: error,
      })
    }

    if (
      NoObjectGeneratedError.isInstance(error) ||
      NoOutputGeneratedError.isInstance(error)
    ) {
      const text = 'text' in error ? (error.text as string) : undefined

      console.error('Search query generation failed.', { prompt, text })

      throw new SearchStageError({
        stage: 'prompt-analysis',
        message:
          'Search analysis returned an unexpected format. Please try your query again.',
        underlyingErrorName: error.name,
        responseText: text,
        details: serializeFailureDetails({
          cause:
            error.cause instanceof Error ? error.cause.message : error.cause,
        }),
        cause: error,
      })
    }

    if (error instanceof Error) {
      const text = 'text' in error ? (error.text as string) : undefined

      console.error('Search query generation failed unexpectedly.', {
        prompt,
        errorName: error.name,
        text,
      })

      throw new SearchStageError({
        stage: 'prompt-analysis',
        message:
          'Search analysis could not be processed. Please try your query again.',
        underlyingErrorName: error.name,
        responseText: text,
        details: serializeFailureDetails({
          error: error.message,
          cause:
            error.cause instanceof Error ? error.cause.message : error.cause,
        }),
        cause: error,
      })
    }

    throw error
  }
}
