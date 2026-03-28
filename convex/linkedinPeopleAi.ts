import { Output, generateText } from 'ai'
import { getJobSearchModel } from './searchModel'
import { structureLinkedInPeopleSystem } from './searchPrompts'
import {
  structuredLinkedInPeopleResultSchema,
} from './searchSchemas'
import type { TavilySearchResult } from './searchTavily'

/**
 * Runs the LinkedIn enrichment pass that turns public web results into a short
 * list of likely employees or hiring contacts.
 *
 * @param input - The retrieval context for the LinkedIn people pass.
 * @param input.company - The company name being researched.
 * @param input.jobTitle - The role title used to bias results.
 * @param input.query - The deterministic Tavily query that was executed.
 * @param input.tavilyResults - The raw Tavily response to structure.
 * @returns Structured LinkedIn people results ready for normalization.
 */
export async function structureLinkedInPeopleResults({
  company,
  jobTitle,
  query,
  tavilyResults,
}: {
  company: string
  jobTitle: string
  query: string
  tavilyResults: TavilySearchResult
}) {
  const { output } = await generateText({
    model: getJobSearchModel(),
    system: structureLinkedInPeopleSystem,
    prompt: JSON.stringify(
      {
        targetCompany: company,
        targetRole: jobTitle,
        generatedQuery: query,
        tavilyResults,
      },
      null,
      2,
    ),
    output: Output.object({
      schema: structuredLinkedInPeopleResultSchema,
    }),
  })

  return output
}
