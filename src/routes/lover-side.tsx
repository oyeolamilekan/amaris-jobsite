import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { createServerFn } from '@tanstack/react-start'
import {
  Link,
  createFileRoute,
  redirect,
  useSearch,
} from '@tanstack/react-router'
import { useMutation as useConvexMutation } from 'convex/react'
import type { Doc } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { AVAILABLE_AI_MODELS } from '../../convex/shared/constants'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
} from 'lucide-react'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Separator } from '~/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '~/components/ui/sidebar'
import { AdminSidebar } from '~/components/admin-sidebar'
import { fetchAuthQuery } from '~/lib/auth-server'
import { cn } from '~/lib/utils'

const ADMIN_VIEWS = ['searches', 'linkedin', 'settings'] as const
type AdminView = (typeof ADMIN_VIEWS)[number]
const ADMIN_VIEW_SET = new Set<string>(ADMIN_VIEWS)

type AdminRouteAccess =
  | { status: 'unauthenticated' }
  | {
      status: 'authorized'
      user: { email: string; name: string; role: 'admin' }
    }
  | {
      status: 'forbidden'
      user: { email: string; name: string; role: 'standard' }
    }

const getAdminRouteAccess = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminRouteAccess> => {
    const user = await fetchAuthQuery(api.auth.getCurrentUser, {})

    if (user === null) {
      return { status: 'unauthenticated' }
    }

    if (user.role !== 'admin') {
      return {
        status: 'forbidden',
        user: {
          email: user.email,
          name: user.name,
          role: 'standard',
        },
      }
    }

    return {
      status: 'authorized',
      user: {
        email: user.email,
        name: user.name,
        role: 'admin',
      },
    }
  },
)

function adminRedirectPath(view: AdminView) {
  if (view === 'searches') {
    return '/lover-side'
  }

  return `/lover-side?view=${encodeURIComponent(view)}`
}

export const Route = createFileRoute('/lover-side')({
  validateSearch: (search: Record<string, unknown>) => ({
    view:
      typeof search.view === 'string' && ADMIN_VIEW_SET.has(search.view)
        ? (search.view as AdminView)
        : 'searches',
  }),
  loaderDeps: ({ search }) => ({
    view: search.view,
  }),
  loader: async ({ deps }) => {
    const access = await getAdminRouteAccess()

    if (access.status === 'unauthenticated') {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: adminRedirectPath(deps.view),
        },
      })
    }

    return access
  },
  component: LoverSideRouteComponent,
  head: () => ({
    meta: [
      { title: 'Admin — Amaris' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})

const ADMIN_PAGE_SIZE = 25

const TIME_PERIODS = [
  { label: 'Today', value: 'day', ms: 24 * 60 * 60 * 1000 },
  { label: 'This week', value: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: 'This month', value: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { label: '3 months', value: '3months', ms: 90 * 24 * 60 * 60 * 1000 },
  { label: '6 months', value: '6months', ms: 180 * 24 * 60 * 60 * 1000 },
  { label: '12 months', value: '12months', ms: 365 * 24 * 60 * 60 * 1000 },
  { label: 'All time', value: 'all', ms: 0 },
] as const

type TimePeriodValue = (typeof TIME_PERIODS)[number]['value']

function getSinceTimestamp(period: TimePeriodValue): number | undefined {
  const entry = TIME_PERIODS.find((p) => p.value === period)
  if (!entry || entry.ms === 0) return undefined
  return Date.now() - entry.ms
}

function periodLabel(period: TimePeriodValue): string {
  if (period === 'all') return ''
  const entry = TIME_PERIODS.find((p) => p.value === period)
  return entry ? ` ${entry.label.toLowerCase()}` : ''
}

function useSinceTimestamp(period: TimePeriodValue) {
  return useMemo(() => getSinceTimestamp(period), [period])
}

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
          <p className="text-sm leading-6 text-muted-foreground">
            {job.summary}
          </p>
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
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="rounded-[1.5rem]">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <div className="flex flex-col gap-1">
              <CardTitle>{search.prompt}</CardTitle>
              <CardDescription>
                {formatDateTime(search.createdAt)}
              </CardDescription>
            </div>

            <CardAction className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  search.status === 'completed' ? 'secondary' : 'outline'
                }
              >
                {formatLabel(search.status)}
              </Badge>
              <Badge variant="outline">{search.totalResults} saved</Badge>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
            </CardAction>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
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
                    Structured job records with admin-only raw source evidence
                    when available.
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

const VIEW_TITLES: Record<AdminView, string> = {
  searches: 'Search Runs',
  linkedin: 'LinkedIn Searches',
  settings: 'Settings',
}

function LoverSideRouteComponent() {
  const access = Route.useLoaderData()

  if (access.status === 'forbidden') {
    return <ForbiddenAdminAccess email={access.user.email} />
  }

  return <AdminPage />
}

function ForbiddenAdminAccess({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-lg rounded-[1.75rem]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Admin access required</CardTitle>
          <CardDescription>
            You&apos;re signed in as {email}, but this account does not have the
            admin role required for this page.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

function AdminPage() {
  const { view } = useSearch({ from: '/lover-side' })
  const title = VIEW_TITLES[view] ?? 'Admin'

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-sm font-medium">{title}</h1>
        </header>
        {view === 'settings' ? (
          <SettingsContent />
        ) : view === 'linkedin' ? (
          <LinkedInContent />
        ) : (
          <AdminContent />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

function SettingsContent() {
  const { data: settings } = useQuery(
    convexQuery(api.admin.queries.getSettings, {}),
  )
  const updateAiModel = useConvexMutation(api.admin.mutations.updateAiModel)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const currentModel = settings?.aiModel ?? ''
  const activeModel = selectedModel ?? currentModel

  async function handleSave() {
    if (!selectedModel || selectedModel === currentModel) return
    setSaving(true)
    setSaved(false)
    try {
      await updateAiModel({ aiModel: selectedModel })
      setSaved(true)
      setSelectedModel(null)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const groupedModels = AVAILABLE_AI_MODELS.reduce(
    (acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = []
      acc[model.provider].push(model)
      return acc
    },
    {} as Record<string, (typeof AVAILABLE_AI_MODELS)[number][]>,
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-4 sm:p-6">
      <Card className="rounded-[1.75rem]">
        <CardHeader>
          <CardTitle>AI Model</CardTitle>
          <CardDescription>
            Choose the AI model used for job classification and extraction.
            Changes apply to all future searches.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Select value={activeModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupedModels).map(([provider, models]) => (
                <SelectGroup key={provider}>
                  <SelectLabel>{provider}</SelectLabel>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {saved
              ? 'Model updated successfully.'
              : settings?.updatedAt
                ? `Last updated ${formatDateTime(settings.updatedAt)}`
                : 'Using default model.'}
          </p>
          <Button
            disabled={
              saving || !selectedModel || selectedModel === currentModel
            }
            onClick={handleSave}
            size="sm"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

type AdminLinkedInEntry = {
  search: Doc<'linkedinPeopleSearches'>
  jobContext: { title: string; company: string; location: string } | null
}

function LinkedInSearchCard({ entry }: { entry: AdminLinkedInEntry }) {
  const { search, jobContext } = entry
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="rounded-[1.5rem]">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <div className="flex flex-col gap-1">
              <CardTitle>
                {search.company} — {search.jobTitle}
              </CardTitle>
              <CardDescription>
                {jobContext
                  ? `${jobContext.title} · ${jobContext.location}`
                  : formatDateTime(search.createdAt)}
              </CardDescription>
            </div>

            <CardAction className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  search.status === 'completed' ? 'secondary' : 'outline'
                }
              >
                {formatLabel(search.status)}
              </Badge>
              <Badge variant="outline">
                {search.totalResults}{' '}
                {search.totalResults === 1 ? 'person' : 'people'}
              </Badge>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
            </CardAction>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <SearchDetail label="Summary" value={search.summary} />
              <SearchDetail label="Search query" mono value={search.query} />
            </div>

            {search.people.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      People found
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      LinkedIn profiles matched for this job.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {search.people.length} results
                  </Badge>
                </div>

                <div className="flex flex-col gap-2">
                  {search.people.map((person, idx) => (
                    <Card key={idx} size="sm">
                      <CardHeader>
                        <div className="flex flex-col gap-1">
                          <CardTitle>{person.name}</CardTitle>
                          <CardDescription>{person.headline}</CardDescription>
                        </div>
                        <CardAction className="flex items-center gap-2">
                          {person.location ? (
                            <Badge variant="outline">{person.location}</Badge>
                          ) : null}
                          {person.linkedinUrl ? (
                            <Button asChild size="sm" variant="ghost">
                              <a
                                href={person.linkedinUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : null}
                        </CardAction>
                      </CardHeader>
                      {person.reason ? (
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            {person.reason}
                          </p>
                        </CardContent>
                      ) : null}
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                No people were found for this search.
              </p>
            )}
          </CardContent>

          <CardFooter className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{search.totalResults} people</span>
              <span aria-hidden="true">•</span>
              <span>{formatDateTime(search.createdAt)}</span>
            </div>
          </CardFooter>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function LinkedInContent() {
  const [pageIndex, setPageIndex] = useState(0)
  const [statsPeriod, setStatsPeriod] = useState<TimePeriodValue>('all')
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([
    null,
  ])
  const sinceTimestamp = useSinceTimestamp(statsPeriod)
  const currentCursor = cursorHistory[pageIndex] ?? null
  const { data, isLoading, isFetching } = useQuery(
    convexQuery(api.linkedin.queries.getAdminLinkedInSearches, {
      paginationOpts: {
        cursor: currentCursor,
        numItems: ADMIN_PAGE_SIZE,
      },
      sinceTimestamp,
    }),
  )
  const { data: stats } = useQuery(
    convexQuery(api.linkedin.queries.getAdminLinkedInStats, {
      sinceTimestamp,
    }),
  )
  const searches = data?.page ?? []
  const isFirstPage = pageIndex === 0
  const isLastPage = data?.isDone ?? true
  const suffix = periodLabel(statsPeriod)

  function goToPreviousPage() {
    if (isFirstPage || isFetching) return
    setPageIndex((i) => Math.max(0, i - 1))
  }

  function goToNextPage() {
    if (!data || data.isDone || isFetching) return
    setCursorHistory((history) => {
      const next = history.slice(0, pageIndex + 1)
      if (next[pageIndex + 1] !== data.continueCursor) {
        next.push(data.continueCursor)
      }
      return next
    })
    setPageIndex((i) => i + 1)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0 sm:p-6 sm:pt-0">
      <Card className="rounded-[1.75rem]">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-3xl sm:text-4xl">
              LinkedIn people searches
            </CardTitle>
            <CardDescription>
              Browse cached LinkedIn people searches linked to saved job
              results. Expand a card to see matched profiles.
            </CardDescription>
          </div>
          <CardAction>
            <Select
              value={statsPeriod}
              onValueChange={(v) => {
                setStatsPeriod(v as TimePeriodValue)
                setPageIndex(0)
                setCursorHistory([null])
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-3">
          <AdminStatCard
            description={`Total LinkedIn searches${suffix}.`}
            title={`${stats?.total ?? '—'} searches`}
          />
          <AdminStatCard
            description={`Searches that found matching people${suffix}.`}
            title={`${stats?.completed ?? '—'} completed`}
          />
          <AdminStatCard
            description={`Searches that returned no profiles${suffix}.`}
            title={`${stats?.noResults ?? '—'} no results`}
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
            <CardTitle>Loading LinkedIn searches</CardTitle>
            <CardDescription>
              Fetching the next page of cached LinkedIn people searches.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : searches.length === 0 ? (
        <Card className="rounded-[1.5rem]">
          <CardHeader>
            <CardTitle>
              {pageIndex === 0
                ? 'No LinkedIn searches yet'
                : 'No more searches'}
            </CardTitle>
            <CardDescription>
              {pageIndex === 0
                ? 'LinkedIn people searches will appear here once triggered from job results.'
                : 'There are no LinkedIn searches on this page.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {searches.map((entry) => (
            <LinkedInSearchCard entry={entry} key={entry.search._id} />
          ))}
        </div>
      )}
    </div>
  )
}

function AdminContent() {
  const [pageIndex, setPageIndex] = useState(0)
  const [statsPeriod, setStatsPeriod] = useState<TimePeriodValue>('all')
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([
    null,
  ])
  const sinceTimestamp = useSinceTimestamp(statsPeriod)
  const currentCursor = cursorHistory[pageIndex] ?? null
  const { data, isLoading, isFetching } = useQuery(
    convexQuery(api.search.queries.getAdminSearchRuns, {
      paginationOpts: {
        cursor: currentCursor,
        numItems: ADMIN_PAGE_SIZE,
      },
      sinceTimestamp,
    }),
  )
  const { data: stats } = useQuery(
    convexQuery(api.search.queries.getAdminSearchStats, {
      sinceTimestamp,
    }),
  )
  const searches = data?.page ?? []
  const isFirstPage = pageIndex === 0
  const isLastPage = data?.isDone ?? true
  const suffix = periodLabel(statsPeriod)

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
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0 sm:p-6 sm:pt-0">
      <Card className="rounded-[1.75rem]">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-3xl sm:text-4xl">
              Search queries, saved results, and failure traces
            </CardTitle>
            <CardDescription>
              Review saved search runs, the queries that produced them, any
              failed traces saved for debugging, and the saved jobs currently
              stored in Convex.
            </CardDescription>
          </div>
          <CardAction>
            <Select
              value={statsPeriod}
              onValueChange={(v) => {
                setStatsPeriod(v as TimePeriodValue)
                setPageIndex(0)
                setCursorHistory([null])
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            description={`Total search runs${suffix}.`}
            title={`${stats?.total ?? '—'} searches`}
          />
          <AdminStatCard
            description={`Runs that completed successfully${suffix}.`}
            title={`${stats?.completed ?? '—'} completed`}
          />
          <AdminStatCard
            description={`Runs that failed${suffix}.`}
            title={`${stats?.failed ?? '—'} failed`}
          />
          <AdminStatCard
            description={`Total saved jobs${suffix}.`}
            title={`${stats?.totalJobs ?? '—'} jobs`}
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
  )
}
