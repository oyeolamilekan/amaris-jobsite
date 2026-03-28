'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action } from './_generated/server'
import {
  DEFAULT_LINKEDIN_PEOPLE_MAX_RESULTS,
  DEFAULT_LINKEDIN_PEOPLE_SEARCH_DEPTH,
} from './searchConstants'
import { getSearchRuntimeConfig } from './searchEnv'
import { structureLinkedInPeopleResults } from './linkedinPeopleAi'
import { normalizeLinkedInPeople } from './linkedinPeopleNormalize'
import { buildLinkedInPeopleSearchQuery } from './linkedinPeopleQueryBuilder'
import { searchTavily } from './searchTavily'

/**
 * Ensures a job result has a saved LinkedIn people lookup, reusing cached data
 * when it already exists and only running the expensive search flow on demand.
 */
export const ensureLinkedInPeopleForJob = action({
  args: {
    jobResultId: v.id('jobResults'),
  },
  /**
   * @param ctx - Action context used to read cached state and persist results.
   * @param args - The job result selected by the user.
   * @returns The id of the saved LinkedIn people search document.
   */
  handler: async (
    ctx,
    args,
  ): Promise<{
    searchId: Id<'linkedinPeopleSearches'>
  }> => {
    const existing: Id<'linkedinPeopleSearches'> | null = await ctx.runQuery(
      internal.linkedinPeople.getLinkedInPeopleSearchForJobInternal,
      {
        jobResultId: args.jobResultId,
      },
    ).then((search) => search?._id ?? null)

    if (existing !== null) {
      return {
        searchId: existing,
      }
    }

    const job = await ctx.runQuery(
      internal.linkedinPeople.getLinkedInPeopleJobContextInternal,
      {
        jobResultId: args.jobResultId,
      },
    )

    if (job === null) {
      throw new Error('Job result not found.')
    }

    const { tavilyApiKey } = getSearchRuntimeConfig()
    const query = buildLinkedInPeopleSearchQuery({
      company: job.company,
      jobTitle: job.title,
    })
    const tavilyResults = await searchTavily(tavilyApiKey, query, {
      searchDepth: DEFAULT_LINKEDIN_PEOPLE_SEARCH_DEPTH,
      maxResults: DEFAULT_LINKEDIN_PEOPLE_MAX_RESULTS,
    })

    if (tavilyResults.results.length === 0) {
      const searchId: Id<'linkedinPeopleSearches'> = await ctx.runMutation(
        internal.linkedinPeople.saveLinkedInPeopleSearch,
        {
          jobResultId: args.jobResultId,
          company: job.company,
          jobTitle: job.title,
          status: 'no_results',
          query,
          summary: `No public LinkedIn profiles were found for ${job.company} yet.`,
          people: [],
        },
      )

      return {
        searchId,
      }
    }

    const structuredResults = await structureLinkedInPeopleResults({
      company: job.company,
      jobTitle: job.title,
      query,
      tavilyResults,
    })

    const people = normalizeLinkedInPeople(structuredResults.people)
    const searchId: Id<'linkedinPeopleSearches'> = await ctx.runMutation(
      internal.linkedinPeople.saveLinkedInPeopleSearch,
      {
        jobResultId: args.jobResultId,
        company: job.company,
        jobTitle: job.title,
        status: people.length > 0 ? 'completed' : 'no_results',
        query,
        summary:
          people.length > 0
            ? structuredResults.summary
            : `No strong LinkedIn profile matches were found for ${job.company}.`,
        people,
      },
    )

    return {
      searchId,
    }
  },
})
