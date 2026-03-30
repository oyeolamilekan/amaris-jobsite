import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { Search } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { SearchLoadingScreen } from '~/components/search-loading-screen'
import {
  ProviderFilter,
  allProviders,
} from '~/components/provider-filter'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { ThemeToggle } from '~/components/theme-toggle'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()
  const initSearch = useMutation(api.search.progress.initSearch)
  const submitSearch = useAction(api.search.actions.submitSearch)

  const [query, setQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progressId, setProgressId] = useState<Id<'searchProgress'> | null>(
    null,
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    ...allProviders,
  ])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = query.trim()

    if (!trimmed) {
      setSubmitError('Enter a search prompt.')
      return
    }

    setSubmitError(null)

    try {
      const id = await initSearch({ prompt: trimmed })
      setProgressId(id)
      setIsSubmitting(true)

      const result = await submitSearch({
        prompt: trimmed,
        progressId: id,
        selectedProviders,
      })

      await navigate({
        to: '/results',
        search: {
          q: trimmed,
          searchId: result.searchId,
        },
      })
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong.',
      )
    } finally {
      setIsSubmitting(false)
      setProgressId(null)
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Job Search
          </h1>
          <p className="max-w-md text-base text-muted-foreground">
            Describe the role you&apos;re looking for and we&apos;ll search
            approved job boards in real time.
          </p>
        </div>

        <form
          className="flex w-full flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <Textarea
            className="min-h-28 resize-none rounded-2xl px-4 py-3 text-base"
            disabled={isSubmitting}
            onChange={(event) => {
              setQuery(event.target.value)
              if (submitError) setSubmitError(null)
            }}
            placeholder='e.g. "Senior backend engineer, remote, Python or Go, Europe"'
            value={query}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
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
          </div>

          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
        </form>
      </div>

      {isSubmitting && progressId ? (
        <SearchLoadingScreen query={query.trim()} progressId={progressId} />
      ) : null}
    </main>
  )
}
