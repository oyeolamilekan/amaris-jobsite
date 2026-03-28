import type { Doc } from '../../convex/_generated/dataModel'
import { ArrowUpRight } from 'lucide-react'
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

function formatScore(score: number) {
  return Number.isInteger(score) ? score.toString() : score.toFixed(2)
}

export type RawSearchResultCardData = Pick<
  Doc<'rawSearchResults'>,
  | 'rank'
  | 'title'
  | 'url'
  | 'content'
  | 'score'
  | 'rawContent'
  | 'classification'
  | 'reason'
  | 'tags'
>

export function RawSearchResultCard({
  rawResult,
}: {
  rawResult: RawSearchResultCardData
}) {
  const fullContent = rawResult.rawContent ?? rawResult.content

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>
            {rawResult.rank}. {rawResult.title}
          </CardTitle>
          <CardDescription className="break-all">
            {rawResult.url}
          </CardDescription>
        </div>

        <CardAction>
          <Badge variant="secondary">
            {formatScore(rawResult.score)} score
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {rawResult.classification || rawResult.tags ? (
          <div className="flex flex-wrap gap-2">
            {rawResult.classification ? (
              <Badge variant="secondary">{rawResult.classification}</Badge>
            ) : null}

            {rawResult.tags?.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {rawResult.reason ? (
          <p className="text-sm leading-6 text-foreground">
            {rawResult.reason}
          </p>
        ) : null}

        <div className="max-h-80 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-4">
          <pre className="font-mono text-xs leading-6 whitespace-pre-wrap break-words text-muted-foreground">
            {fullContent}
          </pre>
        </div>
      </CardContent>

      <CardFooter className="justify-end">
        <Button asChild size="sm" variant="ghost">
          <a href={rawResult.url} rel="noreferrer" target="_blank">
            Open raw result
            <ArrowUpRight data-icon="inline-end" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}
