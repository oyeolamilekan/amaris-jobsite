import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import type { Doc } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

const ADMIN_PAGE_SIZE = 25

type AdminSearchEntry = {
  search: Doc<'searchRuns'>
  jobs: Doc<'jobResults'>[]
}

function formatLabel(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

function AdminStatCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function SearchDetail({
  label,
  value,
  mono = false,
}: {
  label: string
  value?: string | null
  mono?: boolean
}) {
  if (!value) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'text-sm leading-6 text-foreground',
          mono && 'break-all font-mono text-xs',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function SavedJobCard({ job }: { job: Doc<'jobResults'> }) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>
            {job.rank}. {job.title}
          </CardTitle>
          <CardDescription>
            {job.company} · {job.location}
          </CardDescription>
        </div>

        <CardAction className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{formatLabel(job.category)}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Summary</h3>
          <p className="text-sm leading-6 text-muted-foreground">{job.summary}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{formatLabel(job.workArrangement)}</Badge>
          <Badge variant="outline">{formatLabel(job.employmentType)}</Badge>

          {job.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

      </CardContent>

      <CardFooter className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <span className="text-sm text-muted-foreground">{job.source}</span>

        <Button asChild size="sm" variant="ghost">
          <a href={job.url} rel="noreferrer" target="_blank">
            View role
            <ArrowUpRight data-icon="inline-end" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

function SearchRunCard({ entry }: { entry: AdminSearchEntry }) {
  const { search, jobs } = entry

  return (
    <Card className="rounded-[1.5rem]">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{search.prompt}</CardTitle>
          <CardDescription>{formatDateTime(search.createdAt)}</CardDescription>
        </div>

        <CardAction className="flex flex-wrap items-center gap-2">
          <Badge
            variant={search.status === 'completed' ? 'secondary' : 'outline'}
          >
            {formatLabel(search.status)}
          </Badge>
          <Badge variant="outline">{search.totalResults} saved</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <SearchDetail label="Summary" value={search.summary} />
          <SearchDetail
            label="Generated Tavily query"
            mono
            value={search.tavilyQuery}
          />
        </div>

        {search.categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {search.categories.map((category) => (
              <Badge key={category} variant="outline">
                {category}
              </Badge>
            ))}
          </div>
        ) : null}

        {search.failureTrace ? (
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Failure trace
              </h3>
              <p className="text-sm text-muted-foreground">
                Saved debugging context for this failed search run.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <SearchDetail
                label="Failure stage"
                value={formatLabel(search.failureTrace.stage)}
              />
              <SearchDetail
                label="Error message"
                value={search.failureTrace.errorMessage}
              />
              <SearchDetail
                label="Error name"
                value={search.failureTrace.errorName}
              />
              <SearchDetail
                label="Tavily request id"
                mono
                value={search.failureTrace.tavilyRequestId}
              />
              <SearchDetail
                label="Response text"
                mono
                value={search.failureTrace.responseText}
              />
              <SearchDetail
                label="Trace details"
                mono
                value={search.failureTrace.details}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Saved job results
              </h3>
              <p className="text-sm text-muted-foreground">
                Structured job records with admin-only raw source evidence when
                available.
              </p>
            </div>
            <Badge variant="outline">{jobs.length} saved jobs</Badge>
          </div>

          {jobs.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {search.status === 'failed'
                ? 'No saved jobs were stored because this search failed before results could be completed.'
                : 'No saved jobs were stored for this search.'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {jobs.map((job) => (
                <SavedJobCard job={job} key={job._id} />
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{jobs.length} jobs saved</span>
          <span aria-hidden="true">•</span>
          <span>{formatDateTime(search.createdAt)}</span>
        </div>

        <Button asChild size="sm" variant="outline">
          <Link
            search={{
              q: search.prompt,
              searchId: search._id,
            }}
            to="/results"
          >
            Open public view
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function AdminPage() {
  const [pageIndex, setPageIndex] = useState(0)
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([null])
  const currentCursor = cursorHistory[pageIndex] ?? null
  const { data, isLoading, isFetching } = useQuery(
    convexQuery(api.search.queries.getAdminSearchRuns, {
      paginationOpts: {
        cursor: currentCursor,
        numItems: ADMIN_PAGE_SIZE,
      },
    }),
  )
  const searches = data?.page ?? []
  const completedSearches = searches.filter(
    (entry) => entry.search.status === 'completed',
  ).length
  const failedSearches = searches.filter(
    (entry) => entry.search.status === 'failed',
  ).length
  const totalJobs = searches.reduce((sum, entry) => sum + entry.jobs.length, 0)
  const isFirstPage = pageIndex === 0
  const isLastPage = data?.isDone ?? true

  function goToPreviousPage() {
    if (isFirstPage || isFetching) {
      return
    }

    setPageIndex((currentPageIndex) => Math.max(0, currentPageIndex - 1))
  }

  function goToNextPage() {
    if (!data || data.isDone || isFetching) {
      return
    }

    setCursorHistory((history) => {
      const nextHistory = history.slice(0, pageIndex + 1)

      if (nextHistory[pageIndex + 1] !== data.continueCursor) {
        nextHistory.push(data.continueCursor)
      }

      return nextHistory
    })
    setPageIndex((currentPageIndex) => currentPageIndex + 1)
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft data-icon="inline-start" />
              Back home
            </Link>
          </Button>

          <Badge variant="outline">Admin view</Badge>
        </div>

        <Card className="rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="text-3xl sm:text-4xl">
              Search queries, saved results, and failure traces
            </CardTitle>
            <CardDescription>
              Review one page of saved search runs at a time, the queries that
              produced them, any failed traces saved for debugging, and the saved
              jobs currently stored in Convex.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <AdminStatCard
              description="Search runs currently loaded on this page."
              title={`${searches.length} searches`}
            />
            <AdminStatCard
              description="Runs on this page that completed and produced a structured outcome."
              title={`${completedSearches} completed`}
            />
            <AdminStatCard
              description="Runs on this page that failed and now include saved trace context for debugging."
              title={`${failedSearches} failed`}
            />
            <AdminStatCard
              description="Saved jobs currently visible across this page of searches."
              title={`${totalJobs} jobs`}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {pageIndex + 1}
            {isFetching ? ' • Updating…' : ''}
          </p>

          <div className="flex gap-2">
            <Button
              disabled={isFirstPage || isFetching}
              onClick={goToPreviousPage}
              type="button"
              variant="outline"
            >
              <ArrowLeft data-icon="inline-start" />
              Previous
            </Button>

            <Button
              disabled={isLastPage || isFetching}
              onClick={goToNextPage}
              type="button"
              variant="outline"
            >
              Next
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>

        {isLoading && data === undefined ? (
          <Card className="rounded-[1.5rem]">
            <CardHeader>
              <CardTitle>Loading admin searches</CardTitle>
              <CardDescription>
                Fetching the next page of saved searches and results.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : searches.length === 0 ? (
          <Card className="rounded-[1.5rem]">
            <CardHeader>
              <CardTitle>
                {pageIndex === 0 ? 'No saved searches yet' : 'No more searches'}
              </CardTitle>
              <CardDescription>
                {pageIndex === 0
                  ? 'Run a search from the homepage to populate the admin view.'
                  : 'There are no saved searches on this page.'}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {searches.map((entry) => (
              <SearchRunCard entry={entry} key={entry.search._id} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
