# Frontend documentation

This app is a **TanStack Start** frontend that talks to Convex through a typed API layer. The browser UI handles prompt submission, loading states, results rendering, authentication, and the admin dashboard, while Convex owns persistence and the long-running workflows.

For the project overview, see [../README.md](../README.md). For the server-side architecture, see [./backend.md](./backend.md). For the visual data-flow view, see [./system-design.md](./system-design.md).

## Core frontend dependencies

| Dependency | Role in the frontend | Where it shows up |
| --- | --- | --- |
| `react` / `react-dom` | UI rendering | `src/routes/*`, `src/components/*` |
| `@tanstack/react-start` | app shell and server/client runtime | `vite.config.ts`, route files |
| `@tanstack/react-router` | file-based routing and loaders | `src/routes/*`, `src/router.tsx` |
| `@tanstack/react-query` | query caching, suspense, invalidation | `src/router.tsx`, `src/components/results-page-content.tsx` |
| `@convex-dev/react-query` | bridge between Convex queries and React Query | `src/router.tsx`, `convexQuery(...)` call sites |
| `convex/react` | direct Convex hooks for mutations, actions, and live subscriptions | `src/routes/index.tsx`, `src/components/search-loading-screen.tsx` |
| `@convex-dev/better-auth` + `better-auth/react` | auth provider and auth client hooks | `src/router.tsx`, `src/lib/auth-client.ts`, `src/routes/sign-in.tsx` |
| Tailwind CSS | styling | `src/styles/app.css`, route/component class names |

## How the frontend is linked to the backend

The main integration point is [`src/router.tsx`](../src/router.tsx).

It does four important things:

1. reads `VITE_CONVEX_URL`
2. creates a `ConvexQueryClient`
3. creates a React Query `QueryClient` that delegates hashing and query execution to Convex
4. wraps the app in `ConvexBetterAuthProvider` so auth and Convex share the same client connection

That means most frontend reads can use:

```ts
useSuspenseQuery(convexQuery(api.some.module.someQuery, args))
```

while writes use the generated Convex references directly:

```ts
useMutation(api.some.module.someMutation)
useAction(api.some.module.someAction)
```

## Frontend structure

```text
src/
├── router.tsx               # Convex + React Query + auth bootstrap
├── routes/
│   ├── index.tsx            # landing page and initial search submit
│   ├── results.tsx          # saved-results route
│   ├── sign-in.tsx          # Google sign-in page
│   ├── lover-side.tsx       # admin dashboard
│   └── api/auth/$.ts        # Better Auth HTTP bridge
├── components/
│   ├── results-page-content.tsx
│   ├── results-shell.tsx
│   ├── search-loading-screen.tsx
│   ├── linkedin-people-dialog.tsx
│   └── ...
└── lib/
    ├── auth-client.ts
    └── auth-server.ts
```

## Route map

| Route | Purpose | Backend touchpoints |
| --- | --- | --- |
| `/` | landing page and initial prompt submission | `api.search.progress.initSearch`, `api.search.actions.submitSearch` |
| `/results` | loads and renders one saved search result set | `api.search.actions.refreshSearchResultsAvailability`, `api.search.queries.getSearchResultPage`, LinkedIn APIs |
| `/sign-in` | starts Google sign-in | Better Auth client hooks |
| `/lover-side` | admin dashboard for search runs, LinkedIn lookups, and AI settings | `api.auth.getCurrentUser`, admin queries/mutations |
| `/api/auth/$` | server route for Better Auth GET/POST handlers | Better Auth server handler from `src/lib/auth-server.ts` |

## Data-access patterns

The frontend uses a few distinct patterns depending on the job:

| Pattern | Use it for | Example in this repo |
| --- | --- | --- |
| `useSuspenseQuery(convexQuery(...))` | page data that benefits from React Query caching and SSR integration | `results-page-content.tsx` loading `api.search.queries.getSearchResultPage` |
| `useQuery(convexQuery(...))` from React Query | non-suspense cached reads; also used to warm the React Query cache before a suspense-enabled component mounts | `results-page-content.tsx` cache warming in `SavedResultsPage`; `linkedin-people-dialog.tsx`; admin queries in `lover-side.tsx` |
| `useMutation(api...)` from `convex/react` | direct Convex mutations | `index.tsx` and `results-shell.tsx` calling `initSearch` |
| `useAction(api...)` from `convex/react` | long-running server workflows | search submit, availability refresh, LinkedIn people search |
| `useQuery(api...)` from `convex/react` | live subscription-style reads | `search-loading-screen.tsx` subscribing to `getSearchProgress` |
| `fetchAuthQuery(api..., args)` | server-side authenticated Convex reads in loaders and server functions | `lover-side.tsx` checking `api.auth.getCurrentUser` |

## Public search flow

The main user flow spans the landing page, loading overlay, and results page.

1. **The landing page collects a prompt and provider filters.**  
   [`src/routes/index.tsx`](../src/routes/index.tsx) owns the initial form state.

2. **The Search button shows a spinner immediately.**  
   `isSubmitting` is set to `true` before `initSearch` is awaited, so the button disables and shows a `LoaderCircle` icon from the very first tick.

3. **The page creates a progress record.**  
   It calls `useMutation(api.search.mutations.initSearch)` to insert a `searchProgress` document. Once the `progressId` is returned, `SearchLoadingScreen` mounts.

4. **The page starts the backend workflow.**  
   It then calls `useAction(api.search.actions.submitSearch)` with the prompt, `progressId`, and selected providers.

5. **The loading overlay subscribes to progress.**  
   [`src/components/search-loading-screen.tsx`](../src/components/search-loading-screen.tsx) uses `useQuery(api.search.queries.getSearchProgress, { progressId })` from `convex/react` to show live stage updates.

6. **The app navigates to `/results`.**  
   The action returns `searchId`, and the route receives it through the query string.

7. **The results route sets the page title server-side.**  
   `loaderDeps` extracts `q` from validated search params; `loader` returns `{ q }`; `head` uses `loaderData.q` to produce `"<query>" — Amaris` in the SSR-rendered `<title>` and `og:title` tags.

8. **The results page warms the React Query cache and refreshes saved job availability.**  
   [`src/components/results-page-content.tsx`](../src/components/results-page-content.tsx) calls a non-suspending `useQuery(convexQuery(api.search.queries.getSearchResultPage, ...))` immediately on mount so data populates the cache while `api.search.actions.refreshSearchResultsAvailability` runs. Skeleton shimmer placeholders are displayed during both the refresh phase and any subsequent Suspense boundary.

9. **The page loads the saved result set.**  
   After the refresh, `SavedResultsData` reads `api.search.queries.getSearchResultPage` through `useSuspenseQuery(convexQuery(...))`. Because the cache was already warmed, this typically resolves without a visible flash.

## LinkedIn people dialog flow

The results page can trigger a second backend workflow per saved job.

1. A job card calls `handleViewPeople(...)`.
2. The UI starts `api.linkedin.actions.ensureLinkedInPeopleForJob`.
3. After the action resolves, the dialog invalidates the cached `convexQuery(api.linkedin.queries.getLinkedInPeopleSearchForJob, ...)`.
4. [`src/components/linkedin-people-dialog.tsx`](../src/components/linkedin-people-dialog.tsx) reads the saved or cached result and renders loading, empty, error, or completed states based on the backend status.

## Auth and admin flow

Authentication touches both browser code and server-side route logic.

### Browser auth

- [`src/lib/auth-client.ts`](../src/lib/auth-client.ts) creates the Better Auth client.
- [`src/routes/sign-in.tsx`](../src/routes/sign-in.tsx) uses `authClient.useSession()` and `authClient.signIn.social({ provider: 'google' })`.
- [`src/components/auth-button.tsx`](../src/components/auth-button.tsx) links users to `/sign-in`.

### Server-side auth bridge

- [`src/routes/api/auth/$.ts`](../src/routes/api/auth/$.ts) forwards GET and POST requests to the Better Auth handler.
- [`src/lib/auth-server.ts`](../src/lib/auth-server.ts) creates `handler`, `fetchAuthQuery`, `fetchAuthMutation`, and `fetchAuthAction` using the Convex site URLs from environment variables.

### Admin route gating

- [`src/routes/lover-side.tsx`](../src/routes/lover-side.tsx) defines a `createServerFn(...)` that calls `fetchAuthQuery(api.auth.getCurrentUser, {})`.
- Unauthenticated users are redirected to `/sign-in`.
- Non-admin authenticated users are blocked from the admin dashboard.
- Once access is confirmed, the page loads admin queries with `convexQuery(...)` just like the public results page.

## Frontend environment variables

| Variable | Required | Used by | Purpose |
| --- | --- | --- | --- |
| `VITE_CONVEX_URL` | yes | `src/router.tsx`, `src/lib/auth-server.ts` | Convex deployment URL for browser and server-side helpers |
| `VITE_CONVEX_SITE_URL` | yes | `src/lib/auth-server.ts` | site URL used by Better Auth React Start helpers |
| `VITE_SITE_URL` | optional | `src/lib/seo.ts` | public site URL override for SEO metadata |

Backend-only variables such as `AI_GATEWAY_API_KEY` and `TAVILY_API_KEY` are documented in [./backend.md](./backend.md).

## Contributor notes

- Prefer the generated `api` references from `convex/_generated/api`.
- Use the `~/*` alias for imports from `src/*`.
- Prefer `convexQuery(...)` plus React Query for normal reads.
- Keep direct `convex/react` `useQuery(...)` for cases that really want live Convex subscriptions, such as progress updates.
- Do not edit `src/routeTree.gen.ts`.
