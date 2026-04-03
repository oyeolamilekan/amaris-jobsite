import { useState } from 'react'
import type { Doc } from '../../convex/_generated/dataModel'
import { ArrowUpRight, Clock3, LoaderCircle, MapPin, Users } from 'lucide-react'
import type { LinkedInPeopleJob } from '~/components/linkedin-people-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { cn } from '~/lib/utils'

function formatLabel(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function resolveMatchPercentage(job: Doc<'jobResults'>) {
  if (typeof job.relevance === 'number') {
    return Math.max(0, Math.min(100, Math.round(job.relevance)))
  }

  if (typeof job.matchScore === 'number') {
    return Math.max(0, Math.min(100, Math.round(job.matchScore)))
  }

  return 0
}

const matchBadgeBands = [
  {
    min: 90,
    className:
      'border-emerald-500/35 bg-emerald-500/12 text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-500/20 dark:text-emerald-200',
  },
  {
    min: 80,
    className:
      'border-green-500/35 bg-green-500/12 text-green-800 dark:border-green-400/35 dark:bg-green-500/20 dark:text-green-200',
  },
  {
    min: 70,
    className:
      'border-lime-500/35 bg-lime-500/15 text-lime-900 dark:border-lime-400/35 dark:bg-lime-500/20 dark:text-lime-100',
  },
  {
    min: 60,
    className:
      'border-yellow-500/40 bg-yellow-500/20 text-yellow-900 dark:border-yellow-400/35 dark:bg-yellow-500/20 dark:text-yellow-100',
  },
  {
    min: 50,
    className:
      'border-amber-500/40 bg-amber-500/18 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/20 dark:text-amber-100',
  },
  {
    min: 40,
    className:
      'border-orange-500/40 bg-orange-500/18 text-orange-900 dark:border-orange-400/35 dark:bg-orange-500/20 dark:text-orange-100',
  },
  {
    min: 30,
    className:
      'border-red-500/35 bg-red-500/12 text-red-800 dark:border-red-400/35 dark:bg-red-500/20 dark:text-red-200',
  },
  {
    min: 20,
    className:
      'border-rose-500/35 bg-rose-500/12 text-rose-800 dark:border-rose-400/35 dark:bg-rose-500/20 dark:text-rose-200',
  },
  {
    min: 10,
    className:
      'border-pink-500/35 bg-pink-500/12 text-pink-800 dark:border-pink-400/35 dark:bg-pink-500/20 dark:text-pink-200',
  },
  {
    min: 0,
    className:
      'border-fuchsia-500/35 bg-fuchsia-500/12 text-fuchsia-800 dark:border-fuchsia-400/35 dark:bg-fuchsia-500/20 dark:text-fuchsia-200',
  },
] as const

function getMatchBadgeClassName(matchPercentage: number) {
  return (
    matchBadgeBands.find((band) => matchPercentage >= band.min)?.className ??
    matchBadgeBands[matchBadgeBands.length - 1].className
  )
}

type JobResultCardProps = {
  job: Doc<'jobResults'> & {
    favicon?: string
  }
  isPeopleLoading: boolean
  onViewPeople: (job: LinkedInPeopleJob) => Promise<void> | void
}

export function JobResultCard({
  job,
  isPeopleLoading,
  onViewPeople,
}: JobResultCardProps) {
  const [showFavicon, setShowFavicon] = useState(() => Boolean(job.favicon))
  const matchPercentage = resolveMatchPercentage(job)

  return (
    <Card className="rounded-[1.5rem]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>{job.title}</CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2">
              {job.favicon && showFavicon ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-4 shrink-0 rounded-sm object-contain"
                  loading="lazy"
                  onError={() => {
                    setShowFavicon(false)
                  }}
                  src={job.favicon}
                />
              ) : null}
              <span className="truncate">{job.company}</span>
            </CardDescription>
          </div>

          <Badge
            className={cn(
              'w-fit shrink-0 border font-semibold tabular-nums',
              getMatchBadgeClassName(matchPercentage),
            )}
            variant="outline"
          >
            {matchPercentage}% match
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="rounded-[1.25rem] bg-muted/50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Summary
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">{job.summary}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{formatLabel(job.category)}</Badge>
          {job.workArrangement !== 'unspecified' ? (
            <Badge variant="outline">{formatLabel(job.workArrangement)}</Badge>
          ) : null}

          {job.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-4" />
            {job.location}
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="size-4" />
            {formatLabel(job.employmentType)}
          </span>
          <span>{job.source}</span>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            className="rounded-full"
            onClick={() => {
              void onViewPeople({
                _id: job._id,
                title: job.title,
                company: job.company,
              })
            }}
            type="button"
            variant="outline"
          >
            {isPeopleLoading ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Users data-icon="inline-start" />
            )}
            View people
          </Button>

          <Button asChild variant="ghost">
            <a href={job.url} rel="noreferrer" target="_blank">
              View role
              <ArrowUpRight data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
