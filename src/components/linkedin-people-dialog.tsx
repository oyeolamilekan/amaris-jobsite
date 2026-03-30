import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  LoaderCircle,
  MapPin,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

export type LinkedInPeopleJob = {
  _id: Id<'jobResults'>
  title: string
  company: string
}

export function LinkedInPeopleDialog({
  job,
  isLoading,
  error,
  onOpenChange,
}: {
  job: LinkedInPeopleJob | null
  isLoading: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
}) {
  if (job === null) {
    return null
  }

  return (
    <LinkedInPeopleDialogContent
      error={error}
      isLoading={isLoading}
      job={job}
      onOpenChange={onOpenChange}
    />
  )
}

function LinkedInPeopleDialogContent({
  job,
  isLoading,
  error,
  onOpenChange,
}: {
  job: LinkedInPeopleJob
  isLoading: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading: isQueryLoading } = useQuery(
    convexQuery(api.linkedin.queries.getLinkedInPeopleSearchForJob, {
      jobResultId: job._id,
    }),
  )

  const peopleSearch = data ?? null
  const people = peopleSearch?.people ?? []
  const status = peopleSearch?.status ?? null
  const isInProgress = status === 'searching' || status === 'enriching'
  const isBusy = isLoading || isQueryLoading || isInProgress

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto rounded-[1.5rem] p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-2xl">
            People at {job.company}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            Public LinkedIn-discoverable people related to the company behind
            the role “{job.title}”.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-6">
          {isBusy ? (
            <Card className="rounded-[1.5rem]">
              <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
                <div className="space-y-2">
                  <p className="font-medium">
                    {status === 'enriching'
                      ? 'Analyzing profiles'
                      : 'Searching LinkedIn people'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {status === 'enriching'
                      ? `Identifying relevant people at ${job.company}.`
                      : `Looking for public profiles connected to ${job.company}.`}
                  </p>
                </div>

                <div className="flex items-center gap-6 pt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Search className={`size-3.5 ${status === 'searching' ? 'text-foreground' : ''}`} />
                    <span className={status === 'searching' ? 'font-medium text-foreground' : ''}>
                      {status === 'enriching' ? 'Searched' : 'Searching'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className={`size-3.5 ${status === 'enriching' ? 'text-foreground' : ''}`} />
                    <span className={status === 'enriching' ? 'font-medium text-foreground' : ''}>
                      Analyzing
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!isBusy && error ? (
            <Card className="rounded-[1.5rem] border-destructive/40">
              <CardHeader>
                <CardTitle>Couldn&apos;t load people right now</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!isBusy && !error && peopleSearch !== null ? (
            <Card className="rounded-[1.5rem]">
              <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{peopleSearch.summary}</CardTitle>
                  <CardDescription>
                    {peopleSearch.totalResults} people saved for this role.
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  <Users className="mr-2 size-3.5" />
                  {peopleSearch.totalResults} profiles
                </Badge>
              </CardHeader>
            </Card>
          ) : null}

          {!isBusy && !error && peopleSearch !== null && people.length === 0 ? (
            <Card className="rounded-[1.5rem]">
              <CardContent className="py-8">
                <p className="text-sm leading-6 text-muted-foreground">
                  We didn&apos;t find strong public LinkedIn profile matches for
                  this company yet.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {!isBusy && !error && people.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {people.map((person) => (
                <Card className="rounded-[1.5rem]" key={person.linkedinUrl}>
                  <CardHeader className="gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{person.name}</CardTitle>
                      <CardDescription>{person.headline}</CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <BriefcaseBusiness className="size-4" />
                        {job.company}
                      </span>

                      {person.location ? (
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="size-4" />
                          {person.location}
                        </span>
                      ) : null}
                    </div>

                    <Button asChild className="w-full rounded-full" variant="outline">
                      <a
                        href={person.linkedinUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View LinkedIn profile
                        <ArrowUpRight data-icon="inline-end" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
