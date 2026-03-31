import { createFileRoute } from '@tanstack/react-router'
import type { Id } from '../../convex/_generated/dataModel'
import {
  EmptyResultsPage,
  SavedResultsPage,
} from '~/components/results-page-content'

export const Route = createFileRoute('/results')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
    searchId: typeof search.searchId === 'string' ? search.searchId : '',
  }),
  head: () => ({
    meta: [
      { title: 'Search Results — Amaris' },
      {
        name: 'description',
        content:
          'Browse AI-powered job search results aggregated from top job boards in real time.',
      },
      { property: 'og:title', content: 'Search Results — Amaris' },
      {
        property: 'og:description',
        content:
          'Browse AI-powered job search results aggregated from top job boards in real time.',
      },
      { name: 'robots', content: 'noindex, follow' },
    ],
  }),
  component: ResultsPage,
})

function ResultsPage() {
  const { q, searchId } = Route.useSearch()

  if (!searchId) {
    return <EmptyResultsPage initialQuery={q} />
  }

  return (
    <SavedResultsPage
      fallbackQuery={q}
      searchId={searchId as Id<'searchRuns'>}
    />
  )
}
