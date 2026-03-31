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
  head: ({ search }) => {
    const query = (search as { q?: string }).q || ''
    const title = query
      ? `Results for "${query}" — Amaris`
      : 'Search Results — Amaris'
    const description = query
      ? `Job search results for "${query}" — found by Amaris across top job boards.`
      : 'Browse AI-powered job search results from top job boards.'

    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { name: 'robots', content: 'noindex, follow' },
      ],
    }
  },
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
