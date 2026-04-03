import { z } from 'zod'
import {
  employmentTypeValues,
  jobCategoryValues,
  MAX_CATEGORY_COUNT,
  MAX_LINKEDIN_PEOPLE_RESULTS,
  MAX_SAVED_JOB_RESULTS,
  MAX_TAG_COUNT,
  workArrangementValues,
} from './constants'

/**
 * Schema for the single AI call that classifies intent and generates a Tavily
 * query from the user's natural language prompt.
 */
export const searchQuerySchema = z.object({
  intent: z.string().min(1),
  query: z.string().default(''),
})

/**
 * Structured representation of one job result after the app normalizes the
 * Tavily output into the stricter persisted shape.
 */
export const structuredSearchJobSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1).default('Unspecified'),
  summary: z.string().min(1),
  url: z.string().url(),
  favicon: z.string().min(1).optional(),
  source: z.string().min(1),
  category: z.enum(jobCategoryValues),
  workArrangement: z.enum(workArrangementValues).default('unspecified'),
  employmentType: z.enum(employmentTypeValues).default('unspecified'),
  matchScore: z.number().int().min(0).max(100).optional(),
  relevance: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string().min(1)).max(MAX_TAG_COUNT).default([]),
  postedAt: z.string().min(1).optional(),
})

/**
 * Structured output returned by the job-result normalization after the app
 * maps Tavily results into the persisted shape.
 */
export const structuredSearchResultSchema = z.object({
  summary: z.string().min(1),
  categories: z.array(z.string().min(1)).max(MAX_CATEGORY_COUNT).default([]),
  jobs: z
    .array(structuredSearchJobSchema)
    .max(MAX_SAVED_JOB_RESULTS)
    .default([]),
})

/**
 * Schema for the per-result LLM extraction of a LinkedIn person from a single
 * Tavily result. The linkedinUrl is sourced directly from the Tavily result URL
 * and is not extracted by the LLM.
 */
export const structuredLinkedInPersonSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe('The full name of the person only, e.g. "Jane Doe".')
    .optional(),
  headline: z
    .string()
    .min(1)
    .describe(
      'The professional headline or job title, e.g. "Senior Recruiter at Acme Corp".',
    )
    .optional(),
  location: z
    .string()
    .min(1)
    .describe('City, region, or country, e.g. "San Francisco, CA".')
    .optional(),
})

/**
 * Structured output returned by the LinkedIn people enrichment pass.
 */
export const structuredLinkedInPeopleResultSchema = z.object({
  summary: z.string().min(1),
  people: z
    .array(structuredLinkedInPersonSchema)
    .max(MAX_LINKEDIN_PEOPLE_RESULTS)
    .default([]),
})

/**
 * TypeScript type for the LLM query-generation output.
 */
export type SearchQueryResult = z.infer<typeof searchQuerySchema>

/**
 * TypeScript type for one structured job produced by the normalization layer.
 */
export type StructuredSearchJob = z.infer<typeof structuredSearchJobSchema>

/**
 * TypeScript type for the full structured job-search response.
 */
export type StructuredSearchResult = z.infer<
  typeof structuredSearchResultSchema
>

/**
 * TypeScript type for one structured LinkedIn person candidate.
 */
export type StructuredLinkedInPerson = z.infer<
  typeof structuredLinkedInPersonSchema
>

/**
 * TypeScript type for the full structured LinkedIn-people response.
 */
export type StructuredLinkedInPeopleResult = z.infer<
  typeof structuredLinkedInPeopleResultSchema
>

/**
 * Schema for the per-result LLM extraction of structured job metadata.
 * Every field is nullable so the LLM can signal "not determinable".
 */
export const jobExtractionSchema = z.object({
  company: z.string().nullable(),
  location: z.string().nullable(),
  summary: z.string().nullable(),
  source: z.string().nullable(),
  category: z.enum(jobCategoryValues).nullable(),
  employmentType: z.enum(employmentTypeValues).nullable(),
  relevance: z.number().int().min(0).max(100).nullable(),
  tags: z.array(z.string()).max(MAX_TAG_COUNT).nullable(),
})

/**
 * TypeScript type for the LLM job extraction output.
 */
export type JobExtraction = z.infer<typeof jobExtractionSchema>
