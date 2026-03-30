import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  jobResultFields,
  linkedinPeopleSearchStatusValidator,
  savedLinkedInPersonValidator,
  rawSearchResultFields,
  searchFailureTraceValidator,
  searchProgressStageValidator,
  searchStatusValidator,
} from './shared/validators'

/**
 * Convex schema for persisted job-search runs, structured job results, and
 * on-demand LinkedIn people lookups.
 */
export default defineSchema({
  /**
   * Ephemeral progress records for live search status updates.
   */
  searchProgress: defineTable({
    prompt: v.string(),
    stage: searchProgressStageValidator,
    searchId: v.optional(v.id('searchRuns')),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
  /**
   * Stores one top-level search submission and its summary metadata.
   */
  searchRuns: defineTable({
    prompt: v.string(),
    isJobSearch: v.boolean(),
    status: searchStatusValidator,
    tavilyQuery: v.optional(v.string()),
    selectedProviders: v.optional(v.array(v.string())),
    failureTrace: v.optional(searchFailureTraceValidator),
    summary: v.string(),
    categories: v.array(v.string()),
    totalResults: v.number(),
    createdAt: v.number(),
  }).index('by_createdAt', ['createdAt']),
  /**
   * Stores normalized job results keyed back to the originating search run.
   */
  jobResults: defineTable(jobResultFields)
    .index('by_searchRunId', ['searchRunId'])
    .index('by_searchRunId_rank', ['searchRunId', 'rank']),
  /**
   * Legacy raw Tavily result items retained for older search runs while the app
   * transitions to storing raw-result data directly on `jobResults`.
   */
  rawSearchResults: defineTable(rawSearchResultFields).index(
    'by_searchRunId_rank',
    ['searchRunId', 'rank'],
  ),
  /**
   * Stores cached LinkedIn people results keyed to a specific job result.
   */
  linkedinPeopleSearches: defineTable({
    jobResultId: v.id('jobResults'),
    company: v.string(),
    jobTitle: v.string(),
    status: linkedinPeopleSearchStatusValidator,
    query: v.string(),
    summary: v.string(),
    people: v.array(savedLinkedInPersonValidator),
    totalResults: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_jobResultId', ['jobResultId'])
    .index('by_createdAt', ['createdAt']),
  /**
   * Singleton admin settings document for runtime configuration.
   */
  adminSettings: defineTable({
    aiModel: v.string(),
    updatedAt: v.number(),
  }),
})
