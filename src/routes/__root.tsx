import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import * as React from 'react'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'
import { ThemeProvider, themeInitScript } from '~/lib/theme'
import { TooltipProvider } from '~/components/ui/tooltip'
import { Analytics } from '@vercel/analytics/react'
import {
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_URL,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
} from '~/lib/seo'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },
      { name: 'application-name', content: SITE_NAME },
      { name: 'apple-mobile-web-app-title', content: SITE_NAME },

      // Open Graph
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:image', content: OG_IMAGE_URL },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: `${OG_IMAGE_WIDTH}` },
      { property: 'og:image:height', content: `${OG_IMAGE_HEIGHT}` },
      { property: 'og:image:alt', content: OG_IMAGE_ALT },

      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: SITE_DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE_URL },
      { name: 'twitter:image:alt', content: OG_IMAGE_ALT },

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
        href: '/favicon.png',
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
      { rel: 'shortcut icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
      <Analytics />
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
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
