import { v } from 'convex/values'
import {
  employmentTypeValues,
  jobCategoryValues,
  searchFailureStageValues,
  searchProgressStageValues,
  linkedinPeopleSearchStatusValues,
  searchStatusValues,
  workArrangementValues,
} from './constants'

/**
 * Convex validator for search progress stage values.
 */
export const searchProgressStageValidator = v.union(
  v.literal(searchProgressStageValues[0]),
  v.literal(searchProgressStageValues[1]),
  v.literal(searchProgressStageValues[2]),
  v.literal(searchProgressStageValues[3]),
  v.literal(searchProgressStageValues[4]),
)

/**
 * Convex validator for the top-level job search status field.
 */
export const searchStatusValidator = v.union(
  v.literal(searchStatusValues[0]),
  v.literal(searchStatusValues[1]),
  v.literal(searchStatusValues[2]),
)

/**
 * Convex validator for saved search failure stages.
 */
export const searchFailureStageValidator = v.union(
  v.literal(searchFailureStageValues[0]),
  v.literal(searchFailureStageValues[1]),
  v.literal(searchFailureStageValues[2]),
  v.literal(searchFailureStageValues[3]),
  v.literal(searchFailureStageValues[4]),
  v.literal(searchFailureStageValues[5]),
)

/**
 * Shared persisted field definition for a saved search failure trace.
 */
export const searchFailureTraceFields = {
  stage: searchFailureStageValidator,
  errorMessage: v.string(),
  errorName: v.optional(v.string()),
  responseText: v.optional(v.string()),
  details: v.optional(v.string()),
  tavilyRequestId: v.optional(v.string()),
}

/**
 * Convex object validator for saved search failure traces.
 */
export const searchFailureTraceValidator = v.object(searchFailureTraceFields)

/**
 * Convex validator for the LinkedIn people lookup status field.
 */
export const linkedinPeopleSearchStatusValidator = v.union(
  v.literal(linkedinPeopleSearchStatusValues[0]),
  v.literal(linkedinPeopleSearchStatusValues[1]),
  v.literal(linkedinPeopleSearchStatusValues[2]),
  v.literal(linkedinPeopleSearchStatusValues[3]),
)

/**
 * Convex validator for supported job categories.
 */
export const jobCategoryValidator = v.union(
  v.literal(jobCategoryValues[0]),
  v.literal(jobCategoryValues[1]),
  v.literal(jobCategoryValues[2]),
  v.literal(jobCategoryValues[3]),
  v.literal(jobCategoryValues[4]),
  v.literal(jobCategoryValues[5]),
  v.literal(jobCategoryValues[6]),
  v.literal(jobCategoryValues[7]),
  v.literal(jobCategoryValues[8]),
  v.literal(jobCategoryValues[9]),
  v.literal(jobCategoryValues[10]),
)

/**
 * Convex validator for workplace arrangement values.
 */
export const workArrangementValidator = v.union(
  v.literal(workArrangementValues[0]),
  v.literal(workArrangementValues[1]),
  v.literal(workArrangementValues[2]),
  v.literal(workArrangementValues[3]),
)

/**
 * Convex validator for employment type values.
 */
export const employmentTypeValidator = v.union(
  v.literal(employmentTypeValues[0]),
  v.literal(employmentTypeValues[1]),
  v.literal(employmentTypeValues[2]),
  v.literal(employmentTypeValues[3]),
  v.literal(employmentTypeValues[4]),
  v.literal(employmentTypeValues[5]),
  v.literal(employmentTypeValues[6]),
)

/**
 * Shared persisted field definition for one raw Tavily search result item.
 */
export const savedRawSearchResultFields = {
  rank: v.number(),
  url: v.string(),
  title: v.string(),
  content: v.string(),
  score: v.number(),
  rawContent: v.optional(v.string()),
  classification: v.optional(v.string()),
  reason: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
}

/**
 * Convex object validator for one raw Tavily search result payload.
 */
export const savedRawSearchResultValidator = v.object(
  savedRawSearchResultFields,
)

/**
 * Shared persisted field definition for one saved job record.
 */
export const savedJobFields = {
  rank: v.number(),
  title: v.string(),
  company: v.string(),
  location: v.string(),
  summary: v.string(),
  url: v.string(),
  favicon: v.optional(v.string()),
  source: v.string(),
  category: jobCategoryValidator,
  workArrangement: workArrangementValidator,
  employmentType: employmentTypeValidator,
  matchScore: v.optional(v.number()),
  relevance: v.optional(v.number()),
  tags: v.array(v.string()),
  postedAt: v.optional(v.string()),
  availabilityCheckedAt: v.optional(v.number()),
  rawResult: v.optional(savedRawSearchResultValidator),
}

/**
 * Convex object validator for a saved job payload.
 */
export const savedJobValidator = v.object(savedJobFields)

/**
 * Shared persisted field definition for the `jobResults` table.
 */
export const jobResultFields = {
  searchRunId: v.id('searchRuns'),
  ...savedJobFields,
}

/**
 * Shared persisted field definition for one saved LinkedIn person record.
 */
export const savedLinkedInPersonFields = {
  rank: v.number(),
  name: v.optional(v.string()),
  headline: v.optional(v.string()),
  linkedinUrl: v.optional(v.string()),
  reason: v.optional(v.string()),
  location: v.optional(v.string()),
}

/**
 * Convex object validator for a saved LinkedIn person payload.
 */
export const savedLinkedInPersonValidator = v.object(savedLinkedInPersonFields)

/**
 * Shared persisted field definition for the `rawSearchResults` table.
 */
export const rawSearchResultFields = {
  searchRunId: v.id('searchRuns'),
  ...savedRawSearchResultFields,
}
