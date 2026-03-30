import {
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  generateText,
} from 'ai'
import { getJobSearchModel } from '../shared/model'
import { extractJobDetailsSystem } from '../shared/prompts'
import { jobExtractionSchema, type JobExtraction } from '../shared/schemas'
import type { TavilySearchResult } from '../shared/tavily'

const MAX_RAW_CONTENT_LENGTH = 12_000

/**
 * Null extraction used as a safe fallback when the LLM call fails or produces
 * no usable output.
 */
const NULL_EXTRACTION: JobExtraction = {
  company: null,
  location: null,
  summary: null,
  source: null,
  category: null,
  employmentType: null,
  tags: null,
}

type TavilySingleResult = TavilySearchResult['results'][number]

/**
 * Calls the LLM to extract structured job metadata from a single Tavily
 * result. Uses `rawContent` when available, falling back to `content`.
 * Returns `NULL_EXTRACTION` on any failure so the pipeline can continue.
 */
export async function extractJobDetails(
  result: TavilySingleResult,
  modelId?: string,
): Promise<JobExtraction> {
  const content = result.rawContent ?? result.content

  try {
    const { output } = await generateText({
      model: getJobSearchModel(modelId),
      maxOutputTokens: 1024,
      system: extractJobDetailsSystem,
      prompt: [
        `Page title: ${result.title}`,
        `Page URL: ${result.url}`,
        '',
        'Page content:',
        content,
      ].join('\n'),
      output: Output.object({
        schema: jobExtractionSchema,
      }),
    })

    return output ?? NULL_EXTRACTION
  } catch (error) {
    if (
      NoObjectGeneratedError.isInstance(error) ||
      NoOutputGeneratedError.isInstance(error)
    ) {
      console.warn('Job detail extraction produced no output.', {
        url: result.url,
      })
      return NULL_EXTRACTION
    }

    console.warn('Job detail extraction failed.', {
      url: result.url,
      error: error instanceof Error ? error.message : String(error),
    })
    return NULL_EXTRACTION
  }
}

/**
 * Extracts structured metadata from all Tavily results in parallel.
 * Individual failures are silently replaced with null extractions so the
 * pipeline always gets a complete array.
 */
export async function extractAllJobDetails(
  results: TavilySearchResult['results'],
  modelId?: string,
): Promise<JobExtraction[]> {
  const settled = await Promise.allSettled(
    results.map((result) => extractJobDetails(result, modelId)),
  )

  return settled.map((outcome) =>
    outcome.status === 'fulfilled' ? outcome.value : NULL_EXTRACTION,
  )
}
