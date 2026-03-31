import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import * as React from 'react'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'
import { ThemeProvider, themeInitScript } from '~/lib/theme'
import { TooltipProvider } from '~/components/ui/tooltip'

const SITE_NAME = 'Amaris'
const SITE_DESCRIPTION =
  'Search across top job boards in real time. Describe your ideal role and let AI find the best matches for you.'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: `${SITE_NAME} — AI-Powered Job Search` },
      { name: 'description', content: SITE_DESCRIPTION },

      // Open Graph
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: `${SITE_NAME} — AI-Powered Job Search` },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:locale', content: 'en_US' },

      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: `${SITE_NAME} — AI-Powered Job Search` },
      { name: 'twitter:description', content: SITE_DESCRIPTION },

      // Theme & mobile
      { name: 'theme-color', content: '#09090b' },
      { name: 'color-scheme', content: 'light dark' },
      { name: 'format-detection', content: 'telephone=no' },

      // SEO directives
      { name: 'robots', content: 'index, follow' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="text-lg text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <a
          className="text-sm font-medium text-primary underline underline-offset-4"
          href="/"
        >
          Go back to Amaris
        </a>
      </div>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
