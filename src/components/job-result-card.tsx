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

function formatLabel(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

type JobResultCardProps = {
  job: Doc<'jobResults'>
  isPeopleLoading: boolean
  onViewPeople: (job: LinkedInPeopleJob) => Promise<void> | void
}

export function JobResultCard({
  job,
  isPeopleLoading,
  onViewPeople,
}: JobResultCardProps) {
  return (
    <Card className="rounded-[1.5rem]">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{job.title}</CardTitle>
          <CardDescription>{job.company}</CardDescription>
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
