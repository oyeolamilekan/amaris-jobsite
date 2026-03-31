import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { ChevronLeft, Search } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { SearchLoadingScreen } from '~/components/search-loading-screen'
import { ProviderFilter, allProviders } from '~/components/provider-filter'
import { ThemeToggle } from '~/components/theme-toggle'
import { AuthButton } from '~/components/auth-button'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

type ResultsSearchFormProps = {
  initialQuery: string
}

function ResultsSearchForm({ initialQuery }: ResultsSearchFormProps) {
  const navigate = useNavigate()
  const initSearch = useMutation(api.search.progress.initSearch)
  const submitSearch = useAction(api.search.actions.submitSearch)
  const normalizedInitialQuery = initialQuery.trim()
  const [query, setQuery] = useState(normalizedInitialQuery)
  const [loadingQuery, setLoadingQuery] = useState(normalizedInitialQuery)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progressId, setProgressId] = useState<Id<'searchProgress'> | null>(
    null,
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    ...allProviders,
  ])

  useEffect(() => {
    const nextQuery = initialQuery.trim()

    setQuery(nextQuery)
    setLoadingQuery(nextQuery)
    setSubmitError(null)
  }, [initialQuery])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextQuery = query.trim()

    if (!nextQuery) {
      setSubmitError('Enter a search prompt.')
      return
    }

    setSubmitError(null)
    setLoadingQuery(nextQuery)

    try {
      const id = await initSearch({ prompt: nextQuery })
      setProgressId(id)
      setIsSubmitting(true)

      const result = await submitSearch({
        prompt: nextQuery,
        progressId: id,
        selectedProviders,
      })

      await navigate({
        to: '/results',
        search: {
          q: nextQuery,
          searchId: result.searchId,
        },
      })
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
      setProgressId(null)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <form className="w-full" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field
              className="gap-3 sm:flex-row sm:items-center"
              orientation="responsive"
            >
              <FieldLabel className="sr-only" htmlFor="results-query">
                Search query
              </FieldLabel>
              <Input
                className="h-11 rounded-full px-4"
                id="results-query"
                maxLength={200}
                name="q"
                onChange={(event) => {
                  setQuery(event.target.value)

                  if (submitError !== null) {
                    setSubmitError(null)
                  }
                }}
                placeholder="Refine your search"
                value={query}
              />
              <ProviderFilter
                selected={selectedProviders}
                onChange={setSelectedProviders}
              />
              <Button
                className="rounded-full"
                disabled={isSubmitting}
                size="lg"
                type="submit"
              >
                <Search data-icon="inline-start" />
                Search
              </Button>
            </Field>
          </FieldGroup>
        </form>

        {submitError ? (
          <p className="text-sm text-destructive">{submitError}</p>
        ) : null}
      </div>

      {isSubmitting && progressId ? (
        <SearchLoadingScreen query={loadingQuery} progressId={progressId} />
      ) : null}
    </>
  )
}

type ResultsShellProps = {
  title: string
  description: string
  initialQuery: string
  children: ReactNode
}

export function ResultsShell({
  title,
  description,
  initialQuery,
  children,
}: ResultsShellProps) {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost">
            <Link to="/">
              <ChevronLeft data-icon="inline-start" />
              Back
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <AuthButton />
            <Badge variant="outline">AI search</Badge>
          </div>
        </div>

        <Card className="rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="text-3xl sm:text-4xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ResultsSearchForm initialQuery={initialQuery} />
          </CardContent>
        </Card>

        {children}
      </div>
    </main>
  )
}
