import { useState } from 'react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
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
  CardHeader,
  CardTitle,
} from '~/components/ui/card'

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
            Structured and categorized from the live search run.
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

export function SavedResultsPage({
  searchId,
  fallbackQuery,
}: SavedResultsPageProps) {
  const { data } = useSuspenseQuery(
    convexQuery(api.search.getSearchResultPage, {
      searchId,
    }),
  )
  const queryClient = useQueryClient()
  const ensureLinkedInPeopleForJob = useAction(
    api.linkedinPeopleActions.ensureLinkedInPeopleForJob,
  )
  const [activePeopleJob, setActivePeopleJob] =
    useState<LinkedInPeopleJob | null>(null)
  const [peopleError, setPeopleError] = useState<string | null>(null)
  const [loadingPeopleJobId, setLoadingPeopleJobId] =
    useState<Id<'jobResults'> | null>(null)

  function resetPeopleDialog() {
    setActivePeopleJob(null)
    setPeopleError(null)
    setLoadingPeopleJobId(null)
  }

  async function handleViewPeople(job: LinkedInPeopleJob) {
    setActivePeopleJob(job)
    setPeopleError(null)
    setLoadingPeopleJobId(job._id)

    try {
      await ensureLinkedInPeopleForJob({
        jobResultId: job._id,
      })

      const peopleQuery = convexQuery(
        api.linkedinPeople.getLinkedInPeopleSearchForJob,
        {
          jobResultId: job._id,
        },
      )

      await queryClient.invalidateQueries({
        queryKey: peopleQuery.queryKey,
      })
    } catch (error) {
      setPeopleError(getErrorMessage(error))
    } finally {
      setLoadingPeopleJobId(null)
    }
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
      <ResultsSummaryCards
        categories={search.categories}
        totalResults={search.totalResults}
      />

      {jobs.length === 0 ? (
        <Card className="rounded-[1.5rem]">
          <CardHeader>
            <CardTitle>No live job results were structured</CardTitle>
            <CardDescription>
              The search completed, but the retrieved web results did not look
              like credible live openings to save.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <JobResultCard
              isPeopleLoading={loadingPeopleJobId === job._id}
              job={job}
              key={job._id}
              onViewPeople={handleViewPeople}
            />
          ))}
        </div>
      )}

      <LinkedInPeopleDialog
        error={peopleError}
        isLoading={loadingPeopleJobId !== null}
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
