'use node'

import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { action } from '../_generated/server'
import {
  DEFAULT_LINKEDIN_PEOPLE_MAX_RESULTS,
  DEFAULT_LINKEDIN_PEOPLE_SEARCH_DEPTH,
} from '../shared/constants'
import { getSearchRuntimeConfig } from '../shared/env'
import { linkedinPeopleSearchModeValidator } from '../shared/validators'
import {
  buildLinkedInPeopleSearchQuery,
  normalizeLinkedInPeople,
  structureLinkedInPeopleResults,
} from './functions'
import { searchTavily } from '../shared/tavily'

/**
 * Ensures a job result has a saved LinkedIn people lookup, reusing cached data
 * when it already exists and only running the expensive search flow on demand.
 */
export const ensureLinkedInPeopleForJob = action({
  args: {
    jobResultId: v.id('jobResults'),
    mode: linkedinPeopleSearchModeValidator,
  },
  /**
   * @param ctx - Action context used to read cached state and persist results.
   * @param args - On-demand LinkedIn enrichment payload for a saved job.
   * @param args.jobResultId - The saved `jobResults` document selected by the
   * user. The action uses this id to load company and location context before
   * building the LinkedIn-focused Tavily query.
   * @param args.mode - Selected people-search mode.
   * @returns The id of the saved LinkedIn people search document.
   */
  handler: async (
    ctx,
    args,
  ): Promise<{
    searchId: Id<'linkedinPeopleSearches'>
  }> => {
    const job = await ctx.runQuery(
      internal.linkedin.queries.getLinkedInPeopleJobContextInternal,
      {
        jobResultId: args.jobResultId,
      },
    )

    if (job === null) {
      throw new Error('Job result not found.')
    }

    const cachedSearch = await ctx.runQuery(
      internal.linkedin.queries.getLinkedInPeopleSearchForJobInternal,
      {
        jobResultId: args.jobResultId,
        mode: args.mode,
      },
    )

    if (
      cachedSearch !== null &&
      (cachedSearch.status === 'completed' ||
        cachedSearch.status === 'no_results')
    ) {
      return {
        searchId: cachedSearch._id,
      }
    }

    const { tavilyApiKey } = getSearchRuntimeConfig()
    const query = buildLinkedInPeopleSearchQuery({
      company: job.company,
      jobTitle: job.title,
      location: job.location,
      mode: args.mode,
    })
    const modeLabel = args.mode === 'recruiters' ? 'recruiters' : 'people'

    const searchId: Id<'linkedinPeopleSearches'> = await ctx.runMutation(
      internal.linkedin.mutations.saveLinkedInPeopleSearch,
      {
        jobResultId: args.jobResultId,
        company: job.company,
        jobTitle: job.title,
        mode: args.mode,
        status: 'searching',
        query,
        summary: `Searching for ${modeLabel} at ${job.company}…`,
        people: [],
      },
    )

    const tavilyResults = await searchTavily(tavilyApiKey, query, {
      searchDepth: DEFAULT_LINKEDIN_PEOPLE_SEARCH_DEPTH,
      maxResults: DEFAULT_LINKEDIN_PEOPLE_MAX_RESULTS,
    })

    if (tavilyResults.results.length === 0) {
      await ctx.runMutation(
        internal.linkedin.mutations.updateLinkedInPeopleSearchStatus,
        {
          searchId,
          status: 'no_results',
          summary: `No public LinkedIn ${modeLabel} were found for ${job.company} yet.`,
        },
      )

      return {
        searchId,
      }
    }

    await ctx.runMutation(
      internal.linkedin.mutations.updateLinkedInPeopleSearchStatus,
      {
        searchId,
        status: 'enriching',
        summary: `Analyzing ${modeLabel} profiles for ${job.company}…`,
      },
    )

    const structuredResults = structureLinkedInPeopleResults(tavilyResults, {
      company: job.company,
      jobTitle: job.title,
    })

    const people = normalizeLinkedInPeople(structuredResults.people)
    await ctx.runMutation(
      internal.linkedin.mutations.saveLinkedInPeopleSearch,
      {
        jobResultId: args.jobResultId,
        company: job.company,
        jobTitle: job.title,
        mode: args.mode,
        status: people.length > 0 ? 'completed' : 'no_results',
        query,
        summary:
          people.length > 0
            ? structuredResults.summary
            : `No strong LinkedIn ${modeLabel} matches were found for ${job.company}.`,
        people,
      },
    )

    return {
      searchId,
    }
  },
})
