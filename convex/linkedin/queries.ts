import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { QueryCtx } from '../_generated/server'
import { internalMutation, internalQuery, query } from '../_generated/server'
import {
  linkedinPeopleSearchStatusValidator,
  savedLinkedInPersonValidator,
} from '../shared/validators'

const MAX_ADMIN_LINKEDIN_LIMIT = 100

function queryAdminLinkedInSearchesByCreatedAt(
  ctx: QueryCtx,
  sinceTimestamp: number | undefined,
) {
  if (sinceTimestamp === undefined) {
    return ctx.db.query('linkedinPeopleSearches').withIndex('by_createdAt')
  }

  return ctx.db.query('linkedinPeopleSearches').withIndex(
    'by_createdAt',
    (q) => q.gte('createdAt', sinceTimestamp),
  )
}

/**
 * Paginated admin query for all LinkedIn people searches, ordered by
 * most-recently created first. Includes minimal job context for each search.
 */
export const getAdminLinkedInSearches = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sinceTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const numItems = Math.min(
      Math.max(args.paginationOpts.numItems, 1),
      MAX_ADMIN_LINKEDIN_LIMIT,
    )
    const paginationOpts = { ...args.paginationOpts, numItems }
    const page = await queryAdminLinkedInSearchesByCreatedAt(
      ctx,
      args.sinceTimestamp,
    )
      .order('desc')
      .paginate(paginationOpts)

    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (search) => {
          const job = await ctx.db.get(search.jobResultId)
          return {
            search,
            jobContext: job
              ? { title: job.title, company: job.company, location: job.location }
              : null,
          }
        }),
      ),
    }
  },
})

/**
 * Aggregate stats for LinkedIn people searches within an optional time window.
 * Used by the admin dashboard stat cards with time-period filtering.
 */
export const getAdminLinkedInStats = query({
  args: {
    sinceTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const docs = await queryAdminLinkedInSearchesByCreatedAt(
      ctx,
      args.sinceTimestamp,
    ).collect()

    let completed = 0
    let noResults = 0

    for (const doc of docs) {
      if (doc.status === 'completed') completed++
      else if (doc.status === 'no_results') noResults++
    }

    return {
      total: docs.length,
      completed,
      noResults,
    }
  },
})

/**
 * Internal lookup used by actions to check whether a job already has a cached
 * LinkedIn people search.
 */
export const getLinkedInPeopleSearchForJobInternal = internalQuery({
  args: {
    jobResultId: v.id('jobResults'),
  },
  /**
   * @param ctx - Query context used to read cached LinkedIn people searches.
   * @param args - The job result id whose LinkedIn lookup should be checked.
   * @returns The cached LinkedIn people search document or `null`.
   */
  handler: async (ctx, args) => {
    return await ctx.db
      .query('linkedinPeopleSearches')
      .withIndex('by_jobResultId', (q) => q.eq('jobResultId', args.jobResultId))
      .first()
  },
})

/**
 * Public lookup used by the UI to read the saved LinkedIn people search for a
 * job result.
 */
export const getLinkedInPeopleSearchForJob = query({
  args: {
    jobResultId: v.id('jobResults'),
  },
  /**
   * @param ctx - Query context used to read the saved LinkedIn people search.
   * @param args - The job result id selected in the UI.
   * @returns The saved LinkedIn people search document or `null`.
   */
  handler: async (ctx, args) => {
    return await ctx.db
      .query('linkedinPeopleSearches')
      .withIndex('by_jobResultId', (q) => q.eq('jobResultId', args.jobResultId))
      .first()
  },
})

/**
 * Internal lookup that returns the minimum job context required to build a
 * LinkedIn people search.
 */
export const getLinkedInPeopleJobContextInternal = internalQuery({
  args: {
    jobResultId: v.id('jobResults'),
  },
  /**
   * @param ctx - Query context used to read the source job result.
   * @param args - The job result id to load context for.
   * @returns The minimal job context needed for LinkedIn search, or `null`.
   */
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobResultId)

    if (job === null) {
      return null
    }

    return {
      _id: job._id,
      title: job.title,
      company: job.company,
      location: job.location,
      summary: job.summary,
      category: job.category,
    }
  },
})

/**
 * Updates the status of an in-progress LinkedIn people search so the UI can
 * show real-time progress stages.
 */
export const updateLinkedInPeopleSearchStatus = internalMutation({
  args: {
    searchId: v.id('linkedinPeopleSearches'),
    status: linkedinPeopleSearchStatusValidator,
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.searchId)
    if (doc === null) return

    await ctx.db.patch(args.searchId, {
      status: args.status,
      ...(args.summary !== undefined ? { summary: args.summary } : {}),
      updatedAt: Date.now(),
    })
  },
})

/**
 * Inserts or replaces the saved LinkedIn people search document for a job
 * result.
 */
export const saveLinkedInPeopleSearch = internalMutation({
  args: {
    jobResultId: v.id('jobResults'),
    company: v.string(),
    jobTitle: v.string(),
    status: linkedinPeopleSearchStatusValidator,
    query: v.string(),
    summary: v.string(),
    people: v.array(savedLinkedInPersonValidator),
  },
  /**
   * @param ctx - Mutation context used to insert or replace the saved document.
   * @param args - The normalized LinkedIn people search payload to persist.
   * @returns The id of the saved `linkedinPeopleSearches` document.
   */
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('linkedinPeopleSearches')
      .withIndex('by_jobResultId', (q) => q.eq('jobResultId', args.jobResultId))
      .first()

    const document = {
      jobResultId: args.jobResultId,
      company: args.company,
      jobTitle: args.jobTitle,
      status: args.status,
      query: args.query,
      summary: args.summary,
      people: args.people,
      totalResults: args.people.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    if (existing !== null) {
      await ctx.db.replace(existing._id, document)
      return existing._id
    }

    return await ctx.db.insert('linkedinPeopleSearches', document)
  },
})
