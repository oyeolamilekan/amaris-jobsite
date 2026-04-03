import {
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  generateText,
} from 'ai'
import {
  approvedJobHostFamilies,
  defaultProviders,
} from '../shared/constants'
import { SearchStageError, serializeFailureDetails } from '../shared/failure'
import { getJobSearchModel } from '../shared/model'
import { generateSearchQuerySystem } from '../shared/prompts'
import { searchQuerySchema } from '../shared/schemas'

const defaultProviderSet = new Set<string>(defaultProviders)

/**
 * Builds the site clause from either the selected providers or the full host
 * list.
 */
function buildSiteClause(selectedProviders?: string[]) {
  const hosts =
    selectedProviders && selectedProviders.length > 0
      ? approvedJobHostFamilies
          .filter((f) => selectedProviders.includes(f.provider))
          .map((f) => f.queryHost)
      : approvedJobHostFamilies
          .filter((f) => defaultProviderSet.has(f.provider))
          .map((f) => f.queryHost)

  if (hosts.length === 1) return `site:${hosts[0]}`
  return `(${hosts.map((host) => `site:${host}`).join(' OR ')})`
}

/**
 * Normalizes the raw intent string into one of the two supported values.
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
 * query targeting the approved ATS hosts.
 */
export async function generateSearchQuery(
  prompt: string,
  selectedProviders?: string[],
  modelId?: string,
) {
  const siteClause = buildSiteClause(selectedProviders)

  try {
    const { output } = await generateText({
      model: getJobSearchModel(modelId),
      maxOutputTokens: 2048,
      system: generateSearchQuerySystem,
      prompt: [
        `Site clause (copy exactly): ${siteClause}`,
        '',
        `User prompt: ${prompt}`,
      ].join('\n'),
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
