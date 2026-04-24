import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { LoaderCircle, Search } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { SearchLoadingScreen } from '~/components/search-loading-screen'
import {
  ProviderFilter,
  allProviders,
  defaultProviders,
} from '~/components/provider-filter'
import {
  MAX_SELECTED_PROVIDERS,
  providerLabels,
} from '../../convex/shared/constants'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { ThemeToggle } from '~/components/theme-toggle'
import { AuthButton } from '~/components/auth-button'
import {
  HOME_URL,
  LOGO_URL,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_URL,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
} from '~/lib/seo'

const providerNames = allProviders.map(
  (provider) => providerLabels[provider] ?? provider,
)

const seoHighlights = [
  {
    title: 'Search top job boards fast',
    description:
      'Run one prompt across multiple ATS and job-board providers without manually checking each careers page.',
  },
  {
    title: 'Get ranked job matches',
    description:
      'Amaris evaluates each result against your query so the best-fit roles surface first instead of raw search order.',
  },
  {
    title: 'Research the company next',
    description:
      'Open the original role page, review the saved summary, and jump into LinkedIn people results for the company.',
  },
] as const

const seoFaqItems = [
  {
    question: 'How does Amaris find jobs?',
    answer:
      'Amaris turns your prompt into a targeted live web search, retrieves listings from supported ATS and job-board providers, and ranks the saved jobs by relevance.',
  },
  {
    question: 'Which job sites does Amaris support?',
    answer: `Amaris supports providers such as ${providerNames
      .slice(0, 6)
      .join(', ')}, plus other approved ATS platforms.`,
  },
  {
    question: 'What search prompts work best?',
    answer:
      'Include the role title, location, seniority, remote preference, stack, and must-have skills so Amaris can find and rank stronger matches.',
  },
] as const

export const Route = createFileRoute('/')({
  component: HomePage,
  head: () => ({
    meta: [
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: HOME_URL },
      { property: 'og:image', content: OG_IMAGE_URL },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: `${OG_IMAGE_WIDTH}` },
      { property: 'og:image:height', content: `${OG_IMAGE_HEIGHT}` },
      { property: 'og:image:alt', content: OG_IMAGE_ALT },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: SITE_DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE_URL },
      { name: 'twitter:image:alt', content: OG_IMAGE_ALT },
    ],
    links: [{ rel: 'canonical', href: HOME_URL }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              name: SITE_NAME,
              url: HOME_URL,
              logo: LOGO_URL,
            },
            {
              '@type': 'WebSite',
              name: SITE_NAME,
              url: HOME_URL,
              description: SITE_DESCRIPTION,
              inLanguage: 'en-US',
              image: OG_IMAGE_URL,
            },
            {
              '@type': 'WebApplication',
              name: SITE_NAME,
              url: HOME_URL,
              image: OG_IMAGE_URL,
              screenshot: OG_IMAGE_URL,
              description: SITE_DESCRIPTION,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Any',
              browserRequirements:
                'Requires JavaScript and works in modern desktop and mobile browsers.',
              featureList: seoHighlights.map((item) => item.title),
            },
            {
              '@type': 'FAQPage',
              mainEntity: seoFaqItems.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.answer,
                },
              })),
            },
          ],
        }),
      },
    ],
  }),
})

function HomePage() {
  const navigate = useNavigate()
  const initSearch = useMutation(api.search.mutations.initSearch)
  const submitSearch = useAction(api.search.actions.submitSearch)

  const [query, setQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progressId, setProgressId] = useState<Id<'searchProgress'> | null>(
    null,
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    ...defaultProviders,
  ])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = query.trim()

    if (!trimmed) {
      setSubmitError('Enter a search prompt.')
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const id = await initSearch({ prompt: trimmed })
      setProgressId(id)

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
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeToggle />
        <AuthButton />
      </div>

      <div className="flex w-full max-w-5xl flex-col items-center gap-14">
        <section className="flex w-full max-w-2xl flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Amaris
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              AI-powered job search across top ATS and job-board providers. Tell
              Amaris the role, location, seniority, and stack you want, then get
              ranked matches in real time.
            </p>
            <a
              className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              href="https://github.com/oyeolamilekan/amaris-jobsite"
              rel="noreferrer"
              target="_blank"
            >
              <svg
                aria-hidden="true"
                className="size-4 shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              If this helps your job search, a star means a lot — give us one!
              <span aria-hidden="true" className="text-muted-foreground">
                →
              </span>
            </a>
          </div>

          <form className="flex w-full flex-col gap-4" onSubmit={handleSubmit}>
            <Textarea
              className="min-h-28 resize-none rounded-2xl px-4 py-3 text-base"
              disabled={isSubmitting}
              maxLength={200}
              onChange={(event) => {
                setQuery(event.target.value)
                if (submitError) setSubmitError(null)
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
                <span className="text-xs text-muted-foreground">
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
                {isSubmitting ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Search data-icon="inline-start" />
                )}
                {isSubmitting ? 'Searching…' : 'Search'}
              </Button>
            </div>

            {submitError ? (
              <p className="text-sm text-destructive">{submitError}</p>
            ) : null}
          </form>
        </section>
      </div>

      {isSubmitting && progressId ? (
        <SearchLoadingScreen query={query.trim()} progressId={progressId} />
      ) : null}
    </main>
  )
}
