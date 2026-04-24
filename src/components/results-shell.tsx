import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { ArrowUp, ChevronLeft, Search } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { MAX_SELECTED_PROVIDERS } from '../../convex/shared/constants'
import { SearchLoadingScreen } from '~/components/search-loading-screen'
import { ProviderFilter, defaultProviders } from '~/components/provider-filter'
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
import { Textarea } from '~/components/ui/textarea'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

type ResultsSearchFormProps = {
  initialQuery: string
}

function ResultsSearchForm({ initialQuery }: ResultsSearchFormProps) {
  const navigate = useNavigate()
  const initSearch = useMutation(api.search.mutations.initSearch)
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
    ...defaultProviders,
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
      <form className="flex w-full flex-col gap-4" onSubmit={handleSubmit}>
        <Textarea
          className="min-h-28 resize-none rounded-2xl px-4 py-3 text-base"
          disabled={isSubmitting}
          maxLength={200}
          name="q"
          onChange={(event) => {
            setQuery(event.target.value)

            if (submitError !== null) {
              setSubmitError(null)
            }
          }}
          placeholder='e.g. "Senior backend engineer, remote, Python or Go, Europe"'
          value={query}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ProviderFilter
              selected={selectedProviders}
              onChange={setSelectedProviders}
            />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {selectedProviders.length === MAX_SELECTED_PROVIDERS
                ? `Maximum ${MAX_SELECTED_PROVIDERS} job boards selected`
                : `Select up to ${MAX_SELECTED_PROVIDERS} job boards`}
            </span>
          </div>

          <Button
            className="rounded-full"
            disabled={isSubmitting}
            size="lg"
            type="submit"
          >
            <Search data-icon="inline-start" />
            Search
          </Button>
        </div>

        {submitError ? (
          <p className="text-sm text-destructive">{submitError}</p>
        ) : null}
      </form>

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
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 200)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
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
            <Button asChild size="icon" variant="ghost">
              <a
                href="https://github.com/oyeolamilekan/amaris-jobsite"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub repository"
              >
                <svg
                  aria-hidden="true"
                  className="size-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </Button>
            <Badge variant="outline">AI search</Badge>
          </div>
        </div>

        <Card className="rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="text-xl sm:text-3xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ResultsSearchForm initialQuery={initialQuery} />
          </CardContent>
        </Card>

        {children}
      </div>

      {isScrolled ? (
        <Button
          className="fixed bottom-6 right-6 size-12 rounded-full shadow-lg"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          size="icon"
          type="button"
          variant="outline"
          aria-label="Back to top"
        >
          <ArrowUp className="size-5" />
        </Button>
      ) : null}
    </main>
  )
}
