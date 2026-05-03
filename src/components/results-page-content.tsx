import { Suspense, useEffect, useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useAction } from 'convex/react'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import {
  LinkedInPeopleDialog,
  type LinkedInPeopleJob,
} from '~/components/linkedin-people-dialog'
import { JobResultCard } from '~/components/job-result-card'
import { ResultsShell } from '~/components/results-shell'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function ResultsSummaryCards({
  totalResults,
  categories,
}: {
  totalResults: number
  categories: string[]
}) {
  const primaryCategory = categories[0] ?? 'No categories'
  const secondaryCategories =
    categories.slice(1, 4).join(', ') ||
    'Detected themes from the prompt and live results.'

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card size="sm">
        <CardHeader>
          <CardTitle>{totalResults} roles saved</CardTitle>
          <CardDescription>
            Structured from the live search run and refreshed against the source
            URLs.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>{primaryCategory}</CardTitle>
          <CardDescription>{secondaryCategories}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

function ResultsSummaryCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card size="sm">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
      </Card>
      <Card size="sm">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-1 h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
      </Card>
    </div>
  )
}

function JobResultCardSkeleton() {
  return (
    <Card className="rounded-[1.5rem]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="space-y-2 rounded-[1.25rem] bg-muted/50 p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </CardFooter>
    </Card>
  )
}

function ResultsPageSkeleton() {
  return (
    <>
      <ResultsSummaryCardsSkeleton />
      <div className="flex flex-col gap-4">
        <JobResultCardSkeleton />
        <JobResultCardSkeleton />
        <JobResultCardSkeleton />
      </div>
    </>
  )
}

type EmptyResultsPageProps = {
  initialQuery: string
}

export function EmptyResultsPage({ initialQuery }: EmptyResultsPageProps) {
  const query = initialQuery.trim()
  const title = query ? `Ready to search for “${query}”` : 'Search jobs'
  const description = query
    ? 'Submit this query to fetch, structure, and save live job results.'
    : 'Run a search from the landing page or from the form above to fetch, structure, and save live job results.'

  return (
    <ResultsShell description={description} initialQuery={query} title={title}>
      <Card className="rounded-[1.5rem]">
        <CardHeader>
          <CardTitle>No saved results yet</CardTitle>
          <CardDescription>
            {query
              ? 'Use the search form above to run this query.'
              : 'Start with a role, location, seniority, stack, or remote preference to run a live search.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            Searches only appear here after a real run has been classified,
            fetched, structured, and saved.
          </p>
        </CardContent>
      </Card>
    </ResultsShell>
  )
}

export type SavedResultsPageProps = {
  searchId: Id<'searchRuns'>
  fallbackQuery: string
}

type SavedResultsDataProps = SavedResultsPageProps & {
  availabilityRefreshError: string | null
}

function SavedResultsData({
  searchId,
  fallbackQuery,
  availabilityRefreshError,
}: SavedResultsDataProps) {
  const { data } = useSuspenseQuery(
    convexQuery(api.search.queries.getSearchResultPage, {
      searchId,
    }),
  )
  const [activePeopleJob, setActivePeopleJob] =
    useState<LinkedInPeopleJob | null>(null)

  function resetPeopleDialog() {
    setActivePeopleJob(null)
  }

  function handleViewPeople(job: LinkedInPeopleJob) {
    setActivePeopleJob(job)
  }

  if (data === null) {
    return (
      <ResultsShell
        description="We couldn't find a saved search for this id."
        initialQuery={fallbackQuery}
        title="Search not found"
      >
        <Card className="rounded-[1.5rem]">
          <CardHeader>
            <CardTitle>Search not found</CardTitle>
            <CardDescription>
              Try submitting a new prompt from the search form above.
            </CardDescription>
          </CardHeader>
        </Card>
      </ResultsShell>
    )
  }

  const { search, jobs } = data
  const activeQuery = fallbackQuery || search.prompt

  if (search.status === 'failed') {
    return (
      <ResultsShell
        description={search.summary}
        initialQuery={search.prompt}
        title={`Search failed for “${activeQuery}”`}
      >
        <Card className="rounded-[1.5rem]">
          <CardHeader>
            <CardTitle>This search could not be completed</CardTitle>
            <CardDescription>{search.summary}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Try running the search again or adjusting the wording of your
              prompt. The failed attempt was saved internally for debugging.
            </p>
          </CardContent>
        </Card>
      </ResultsShell>
    )
  }

  if (search.status === 'not_job_search') {
    return (
      <ResultsShell
        description={search.summary}
        initialQuery={search.prompt}
        title={`Prompt review for “${activeQuery}”`}
      >
        <Card className="rounded-[1.5rem]">
          <CardHeader>
            <CardTitle>
              This prompt does not look like a job search yet
            </CardTitle>
            <CardDescription>{search.summary}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Try adding the role, location, level, stack, or job filters you
              care about. For example: “remote senior frontend engineer roles in
              Europe using React and TypeScript”.
            </p>
          </CardContent>
        </Card>
      </ResultsShell>
    )
  }

  return (
    <ResultsShell
      description={search.summary}
      initialQuery={activeQuery}
      title={`Results for “${activeQuery}”`}
    >
      {availabilityRefreshError ? (
        <p className="text-sm text-destructive">{availabilityRefreshError}</p>
      ) : null}

      <ResultsSummaryCards
        categories={search.categories}
        totalResults={search.totalResults}
      />

      {jobs.length === 0 ? (
        <Card className="rounded-[1.5rem]">
          <CardHeader>
            <CardTitle>No active job postings remain</CardTitle>
            <CardDescription>
              The search completed, but no active job postings remain in this
              saved result set.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <JobResultCard
              isPeopleLoading={false}
              job={job}
              key={job._id}
              onViewPeople={handleViewPeople}
            />
          ))}
        </div>
      )}

      <LinkedInPeopleDialog
        job={activePeopleJob}
        onOpenChange={(open) => {
          if (!open) {
            resetPeopleDialog()
          }
        }}
      />
    </ResultsShell>
  )
}

export function SavedResultsPage({
  searchId,
  fallbackQuery,
}: SavedResultsPageProps) {
  const refreshSearchResultsAvailability = useAction(
    api.search.actions.refreshSearchResultsAvailability,
  )
  // Warm the React Query / Convex cache while the availability refresh runs so
  // that SavedResultsData's useSuspenseQuery finds data ready on first mount.
  useQuery(convexQuery(api.search.queries.getSearchResultPage, { searchId }))
  const [isRefreshingAvailability, setIsRefreshingAvailability] = useState(true)
  const [availabilityRefreshError, setAvailabilityRefreshError] = useState<
    string | null
  >(null)

  useEffect(() => {
    let isCancelled = false

    async function refreshAvailability() {
      setIsRefreshingAvailability(true)
      setAvailabilityRefreshError(null)

      try {
        await refreshSearchResultsAvailability({
          searchId,
        })
      } catch (error) {
        if (!isCancelled) {
          setAvailabilityRefreshError(getErrorMessage(error))
        }
      } finally {
        if (!isCancelled) {
          setIsRefreshingAvailability(false)
        }
      }
    }

    void refreshAvailability()

    return () => {
      isCancelled = true
    }
  }, [refreshSearchResultsAvailability, searchId])

  if (isRefreshingAvailability) {
    return (
      <ResultsShell
        description="Checking which saved job postings are still live before showing this result set."
        initialQuery={fallbackQuery}
        title={
          fallbackQuery
            ? `Refreshing results for “${fallbackQuery}”`
            : 'Refreshing saved results'
        }
      >
        <ResultsPageSkeleton />
      </ResultsShell>
    )
  }

  return (
    <Suspense
      fallback={
        <ResultsShell
          description="Loading your search results."
          initialQuery={fallbackQuery}
          title={
            fallbackQuery ? `Results for "${fallbackQuery}"` : 'Your results'
          }
        >
          <ResultsPageSkeleton />
        </ResultsShell>
      }
    >
      <SavedResultsData
        availabilityRefreshError={availabilityRefreshError}
        fallbackQuery={fallbackQuery}
        searchId={searchId}
      />
    </Suspense>
  )
}
