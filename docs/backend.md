# Backend documentation

This app uses **Convex** as its application backend. Convex stores the search data model, exposes typed APIs to the frontend, runs the long-lived search and enrichment workflows, and hosts the Better Auth integration.

For the project overview, see [../README.md](../README.md). For the UI-side integration layer, see [./frontend.md](./frontend.md). For the visual architecture, see [./system-design.md](./system-design.md).

## Backend responsibilities

- persist live search progress, saved searches, job results, LinkedIn people lookups, and admin settings
- run external-service workflows that need network access and longer execution time
- expose typed read APIs for the results page and admin dashboard
- register authentication routes and enforce admin-only access where needed

## Core backend dependencies

| Dependency | Role in the backend | Where it shows up |
| --- | --- | --- |
| `convex` | database, schema, queries, mutations, actions, and HTTP router | `convex/schema.ts`, `convex/search/*`, `convex/linkedin/*`, `convex/http.ts` |
| `@convex-dev/better-auth` + `better-auth` | authentication component, session storage, Google auth integration, auth helpers | `convex/auth.ts`, `convex/auth.config.ts`, `convex/convex.config.ts`, `convex/betterAuth/*` |
| `ai` | structured LLM calls for query generation and per-job extraction | `convex/search/facets.ts`, `convex/search/extract.ts` |
| AI Gateway models | actual model provider routing behind the `ai` SDK | `convex/shared/model.ts`, `convex/admin/settings.ts`, `convex/shared/constants.ts` |
| Tavily API | live web retrieval for job listings and LinkedIn profile discovery | `convex/shared/tavily.ts`, `convex/search/pipeline.ts`, `convex/linkedin/actions.ts` |
| `zod` | schemas for structured AI output | `convex/shared/schemas.ts` |

## Backend layout

```text
convex/
├── schema.ts                 # Convex tables owned by this app
├── search/                   # Job search actions, queries, normalization, pipeline
├── linkedin/                 # LinkedIn people lookup actions and queries
├── admin/                    # Admin-only settings and stats
├── shared/                   # Constants, env helpers, prompts, schemas, validators
├── auth.ts                   # Better Auth setup and auth helpers
├── auth.config.ts            # Auth provider config for Convex
├── http.ts                   # Registers auth HTTP routes
├── convex.config.ts          # Mounts the Better Auth component
└── betterAuth/               # Component-owned auth integration files
```

## Application data model

The app-owned Convex schema lives in [`convex/schema.ts`](../convex/schema.ts).

| Table | Purpose | Written by | Read by |
| --- | --- | --- | --- |
| `searchProgress` | ephemeral progress updates for the loading overlay | `search.progress.initSearch`, `search.progress.updateSearchProgress` | `search.progress.getSearchProgress` |
| `searchRuns` | one saved search attempt with summary metadata and status | `search.queries.saveSearchOutcome` | public results query and admin search queries |
| `jobResults` | normalized job rows attached to a search run | `search.queries.saveSearchOutcome` | results page, availability refresh, LinkedIn lookup, admin dashboard |
| `linkedinPeopleSearches` | cached people results for a single saved job | `linkedin.queries.saveLinkedInPeopleSearch` | LinkedIn dialog and admin LinkedIn view |
| `adminSettings` | singleton settings document for the selected AI model | `admin.settings.updateAiModel` | `admin.settings.getSettings`, `admin.settings.getSettingsInternal` |

### Auth data

The Better Auth component mounted from [`convex/convex.config.ts`](../convex/convex.config.ts) owns its own auth tables under `convex/betterAuth/`. Those tables are separate from the app schema above but are part of the running backend.

## Public backend API surface

These are the main APIs the frontend consumes through the generated `api.*` references:

| API | Type | What it does |
| --- | --- | --- |
| `api.search.progress.initSearch` | mutation | creates a progress document before a long-running search starts |
| `api.search.progress.getSearchProgress` | query | returns the current progress stage for the loading UI |
| `api.search.actions.submitSearch` | action | orchestrates prompt classification, Tavily retrieval, extraction, normalization, and persistence |
| `api.search.actions.refreshSearchResultsAvailability` | action | rechecks saved posting URLs and removes jobs that are no longer live |
| `api.search.queries.getSearchResultPage` | query | returns the saved search and ranked jobs shown on `/results` |
| `api.linkedin.actions.ensureLinkedInPeopleForJob` | action | runs or reuses a LinkedIn people search for one saved job |
| `api.linkedin.queries.getLinkedInPeopleSearchForJob` | query | returns the saved LinkedIn people lookup for the dialog UI |
| `api.auth.getCurrentUser` | query | returns the authenticated Better Auth user or `null` |
| `api.admin.settings.getSettings` / `updateAiModel` | query / mutation | reads and updates the admin-selected AI model |
| `api.search.queries.getAdminSearchRuns` / `getAdminSearchStats` | queries | powers the admin search dashboard |
| `api.linkedin.queries.getAdminLinkedInSearches` / `getAdminLinkedInStats` | queries | powers the admin LinkedIn dashboard |

## How the job search backend flow works

The main search flow starts in [`convex/search/actions.ts`](../convex/search/actions.ts).

1. **The UI creates a progress record.**  
   `api.search.progress.initSearch` inserts a `searchProgress` document with the initial stage set to `analyzing`.

2. **`submitSearch` validates the request.**  
   The action trims the prompt, rejects empty prompts, validates the selected provider list, and loads the currently configured AI model from `internal.admin.settings.getSettingsInternal`.

3. **The backend classifies the prompt and builds a query.**  
   [`convex/search/facets.ts`](../convex/search/facets.ts) calls `generateText(...)` from the `ai` SDK with the system prompt from [`convex/shared/prompts.ts`](../convex/shared/prompts.ts). The output schema comes from [`convex/shared/schemas.ts`](../convex/shared/schemas.ts).

4. **Non-job-search prompts exit early.**  
   If the model classifies the input as `not_job_search`, the backend writes a `searchRuns` record with that status and returns immediately. No Tavily call happens in this branch.

5. **Provider scoping is resolved.**  
   [`convex/search/pipeline.ts`](../convex/search/pipeline.ts) turns the selected provider list into a list of allowed domains using `resolveJobSearchDomains(...)` from [`convex/shared/constants.ts`](../convex/shared/constants.ts).

6. **Tavily retrieves live job pages.**  
   [`convex/shared/tavily.ts`](../convex/shared/tavily.ts) sends the generated query to Tavily with `search_depth: advanced`, `time_range: month`, and `max_results: 20`. The provider-domain filter is applied via `include_domains`. Up to 20 candidates enter the pipeline; the final saved output is capped at 10 after filtering and deduplication.

7. **Dead job links are filtered out early.**  
   [`convex/search/availability.ts`](../convex/search/availability.ts) directly fetches each result URL and removes clear 404/expired/closed postings before extraction continues.

8. **Each live result gets structured metadata.**  
   [`convex/search/extract.ts`](../convex/search/extract.ts) runs a per-result LLM extraction for company, location, summary, category, employment type, relevance, and tags. Failures fall back to `null` fields so the pipeline can still complete.

9. **Raw results become saved jobs.**  
   [`convex/search/normalize.ts`](../convex/search/normalize.ts) deduplicates by URL, derives fallback values, computes ranking, and caps the final result set.

10. **The final outcome is persisted.**  
    `internal.search.queries.saveSearchOutcome` inserts one `searchRuns` document plus one `jobResults` document per normalized job.

11. **Progress is updated and the action returns `searchId`.**  
    The frontend uses that `searchId` to navigate to the results page.

### Failure handling

Failures are tracked with `SearchStageError` and the `failureTrace` shape from [`convex/shared/failure.ts`](../convex/shared/failure.ts) and [`convex/shared/validators.ts`](../convex/shared/validators.ts).

When the pipeline throws:

- the `searchProgress` record is updated to `failed`
- the backend attempts to save a failed `searchRuns` row
- the client still gets a user-facing error message instead of a silent fallback

### Query generation and Tavily tuning

The LLM query is generated in [`convex/search/facets.ts`](../convex/search/facets.ts) using the system prompt in [`convex/shared/prompts.ts`](../convex/shared/prompts.ts). Several tuning decisions improve recall and precision:

| Setting | Value | Reason |
| --- | --- | --- |
| `max_results` | 20 | larger candidate pool survives availability filtering; final output still capped at 10 |
| `time_range` | `month` | captures live listings up to 4 weeks old instead of just 7 days |
| LLM query char limit | 380 | gives the model more space before dropping location or technology clauses |
| Location exclusions | conditional | `-India -USA` etc. are appended only when a specific region is detected in the prompt; global searches are not filtered |
| Boost phrase | ATS page signals | `"job description" OR "apply now"` replaces social-media phrases that pulled in off-target results |

## Saved-results refresh flow

Before the results page renders the saved search, the frontend triggers `api.search.actions.refreshSearchResultsAvailability`.

That action:

1. loads the saved search and jobs
2. skips work for non-job-search or already-empty results
3. rechecks only jobs whose availability timestamp is stale
4. deletes unavailable jobs and any linked `linkedinPeopleSearches`
5. updates the parent search summary and counts so the stored result set stays consistent

This keeps old saved searches from showing clearly dead links.

## LinkedIn people enrichment flow

The LinkedIn flow lives under [`convex/linkedin`](../convex/linkedin).

1. The UI calls `api.linkedin.actions.ensureLinkedInPeopleForJob` with a `jobResultId`.
2. The action loads minimal job context from `internal.linkedin.queries.getLinkedInPeopleJobContextInternal`.
3. [`convex/linkedin/queryBuilder.ts`](../convex/linkedin/queryBuilder.ts) builds a deterministic Tavily query focused on `linkedin.com/in` results and recruiter-style titles.
4. The backend creates or updates a `linkedinPeopleSearches` row with status `searching`.
5. Tavily fetches LinkedIn-like public results.
6. [`convex/linkedin/parse.ts`](../convex/linkedin/parse.ts) parses titles and content deterministically; this flow does **not** use an LLM.
7. The normalized people list is persisted with status `completed` or `no_results`.
8. The frontend reads the saved record through `api.linkedin.queries.getLinkedInPeopleSearchForJob`.

## Auth and admin behavior

Authentication is centered in [`convex/auth.ts`](../convex/auth.ts).

- Better Auth is mounted as a Convex component through [`convex/convex.config.ts`](../convex/convex.config.ts).
- [`convex/http.ts`](../convex/http.ts) registers the Better Auth HTTP routes.
- New users default to the `standard` role through a database hook.
- `requireAuthenticatedUser(...)` and `requireAdminUser(...)` gate protected backend APIs.
- `api.auth.getCurrentUser` is the main frontend-facing identity query.

Admin-only settings live in [`convex/admin/settings.ts`](../convex/admin/settings.ts):

- `getSettings` exposes the selected AI model to the admin UI
- `updateAiModel` changes the singleton setting
- `getSettingsInternal` lets the search action pick up the current model before it runs

## Runtime configuration

| Variable | Required | Used by | Purpose |
| --- | --- | --- | --- |
| `AI_GATEWAY_API_KEY` | yes | `convex/shared/env.ts` | authenticates `ai` SDK calls used for query generation and extraction |
| `TAVILY_API_KEY` | yes | `convex/shared/env.ts`, `convex/shared/tavily.ts` | authenticates live web searches |
| `SITE_URL` | yes | `convex/auth.ts` | Better Auth base URL |
| `GOOGLE_CLIENT_ID` | yes | `convex/auth.ts` | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | yes | `convex/auth.ts` | Google OAuth client secret |

Frontend-specific variables such as `VITE_CONVEX_URL` are documented in [./frontend.md](./frontend.md).

## Contributor notes

- Prefer `query`, `mutation`, and `action` from `convex/_generated/server` for public APIs.
- Use `ctx.runQuery`, `ctx.runMutation`, and `ctx.runAction` when one Convex function calls another.
- Keep validators in `shared/validators.ts` and structured AI schemas in `shared/schemas.ts`.
- Do not edit files under `convex/_generated/`.
