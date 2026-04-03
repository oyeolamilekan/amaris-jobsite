# How `submitSearch` works

This document explains the end-to-end flow for `convex/searchActions.ts` and the supporting modules it calls.

## What `submitSearch` is

`submitSearch` is the main Convex action that turns a free-form search prompt into a saved search run.

It is implemented as an `action` instead of a query or mutation because it needs to:

- read runtime environment variables
- call external services
- run AI model steps
- then persist the final result through internal Convex mutations

The action returns:

```ts
{
  searchId: Id<'searchRuns'>
}
```

The frontend calls it with `useAction(api.searchActions.submitSearch)` and then navigates to the results page with the returned `searchId`.

## High-level pipeline

At a high level, `submitSearch` does this:

1. Validate the user prompt.
2. Load required runtime configuration.
3. Run AI prompt analysis to decide whether the prompt is actually a job search.
4. If it is not a job search, save that classification and stop early.
5. If it is a job search, build a host-constrained Tavily query.
6. Fetch live search results from Tavily.
7. Run a second AI pass to turn those results into structured job records.
8. Normalize the AI output into strict internal shapes.
9. Save the search run and saved jobs.
10. If anything fails, save a failed search run with trace data and rethrow a user-facing error.

## Step-by-step flow

### 1. Validate the prompt

File: `convex/searchActions.ts`

The handler trims `args.prompt` and immediately rejects an empty string:

```ts
const prompt = args.prompt.trim()

if (!prompt) {
  throw new Error('Please enter a search prompt.')
}
```

This is the only direct input validation at the action boundary. Everything else is downstream normalization.

### 2. Load runtime configuration

File: `convex/searchEnv.ts`

`getSearchRuntimeConfig()` ensures the required environment is present before the expensive work starts.

Right now it verifies:

- `AI_GATEWAY_API_KEY`
- `TAVILY_API_KEY`

If a required variable is missing, the action throws before any search is attempted.

### 3. Analyze the prompt

Files:

- `convex/searchActions.ts`
- `convex/searchFacets.ts`
- `convex/searchPrompts.ts`
- `convex/searchSchemas.ts`

`submitSearch` calls:

```ts
const promptAnalysis = await analyzeSearchPrompt(prompt)
```

This is the first AI pass. Its job is to turn the raw user text into structured search facets such as:

- `intent`
- `categories`
- `titles`
- `companies`
- `locations`
- `seniority`
- `employmentTypes`
- `remotePreference`
- `keywords`

The raw model output is normalized before the rest of the pipeline uses it. That normalization is important because it:

- maps fuzzy values into supported enums
- trims and deduplicates lists
- caps list sizes
- preserves location detail like country when the prompt clearly includes it

The action also stores:

- `categories = dedupeStrings(promptAnalysis.categories)`

Those values are reused later both for success and for failure persistence.

### 4. Early exit for non-job-search prompts

Files:

- `convex/searchActions.ts`
- `convex/search.ts`

If the first AI pass decides the prompt is not a job search, the pipeline stops early.

In that branch the action saves a `searchRuns` record with:

- `isJobSearch: false`
- `status: 'not_job_search'`
- a fallback summary
- no jobs

That save happens through the internal mutation:

```ts
internal.search.saveSearchOutcome
```

The action still returns a `searchId`, but there is no Tavily request and no second AI pass.

### 5. Build the Tavily query

Files:

- `convex/searchActions.ts`
- `convex/searchQueryBuilder.ts`
- `convex/searchConstants.ts`

If the prompt is a job search, `submitSearch` builds a deterministic query for Tavily:

```ts
tavilyQuery = buildHostConstrainedJobSearchQuery({
  prompt,
  facets: promptAnalysis,
})
```

This query builder does two important things:

- it turns structured facets into search clauses
- it constrains the query to approved job-board / company-host families using `site:` clauses

The builder progressively shortens the content clauses if the query would exceed Tavily's length limit, and falls back to a trimmed version of the prompt if needed.

### 6. Retrieve raw results from Tavily

Files:

- `convex/searchActions.ts`
- `convex/searchTavily.ts`

The action then calls:

```ts
const tavilyResults = await searchTavilyJobs(tavilyApiKey, tavilyQuery)
```

`searchTavilyJobs()` is a thin wrapper over `searchTavily()` with job-search defaults. The response is normalized into a predictable shape:

- `query`
- `requestId`
- `responseTime`
- `results[]`

Each result includes:

- `title`
- `url`
- `content`
- `score`
- optional `rawContent`

For job searches, `includeRawContent` is enabled so the app can preserve richer evidence for admin inspection later.

### 7. Structure the search results into jobs

Files:

- `convex/searchActions.ts`
- `convex/searchAi.ts`
- `convex/searchPrompts.ts`
- `convex/searchSchemas.ts`
- `convex/searchNormalize.ts`

This is the second AI pass:

```ts
const structuredResults = await structureJobResults({
  prompt,
  promptAnalysis,
  tavilyQuery,
  tavilyResults,
})
```

The structuring step receives:

- the original user prompt
- the normalized prompt analysis
- the exact Tavily query that was sent
- a compact view of Tavily results

It asks the model to produce:

- an overall search summary
- categories
- structured job records
- raw-result classifications

Each job extraction now also includes a query-aware `relevance` score so the
saved jobs can reflect how well the listing matches the user’s original prompt,
separately from Tavily’s own retrieval score.

The important implementation detail is that this pass does **not** trust the model output directly. It first accepts a looser schema and then normalizes into the stricter internal result shape. That makes the pipeline more resilient to imperfect model output.

### 8. Normalize raw results and jobs

Files:

- `convex/searchActions.ts`
- `convex/searchNormalize.ts`

After the second AI pass, the action runs two normalization steps.

#### Raw result normalization

```ts
const normalizedRawResults = normalizeRawSearchResults(
  tavilyResults.results,
  structuredResults.rawResults,
)
```

This produces a persistable record for every Tavily result, combining:

- Tavily rank, title, URL, content, score, and raw content
- optional AI classification metadata like `classification`, `reason`, and `tags`

#### Job normalization

```ts
const normalizedJobs = normalizeStructuredJobs(
  structuredResults.jobs,
  new Map(normalizedRawResults.map((rawResult) => [rawResult.url, rawResult])),
)
```

This step:

- deduplicates jobs by URL
- caps the number of saved jobs
- normalizes summary text and enums
- applies fallback values where needed
- preserves `matchScore` when available
- assigns a separate query-aware `relevance` field
- attaches the matching raw result evidence by exact URL

That final point is important: new runs do not save separate user-facing raw-result rows. Instead, matching raw evidence is embedded into each saved job as `job.rawResult`, which is then only surfaced in admin flows.

### 9. Merge categories

Files:

- `convex/searchActions.ts`
- `convex/searchNormalize.ts`

The final categories saved for the run are a merge of:

- prompt-analysis categories
- AI-structured categories

The merge trims, deduplicates, and caps the list:

```ts
const mergedCategories = mergeSearchCategories(
  promptAnalysis.categories,
  structuredResults.categories,
)
```

### 10. Persist the completed search

Files:

- `convex/searchActions.ts`
- `convex/search.ts`

On success, the action writes the final result through:

```ts
internal.search.saveSearchOutcome
```

The mutation inserts:

- one `searchRuns` document
- one `jobResults` document per normalized job

The saved search run includes values like:

- `prompt`
- `isJobSearch`
- `status: 'completed'`
- `summary`
- `categories`
- `tavilyQuery`
- `totalResults`

Each saved job includes values like:

- `rank`
- `title`
- `company`
- `location`
- `summary`
- `url`
- `source`
- `category`
- `workArrangement`
- `employmentType`
- `tags`
- optional `matchScore`
- optional `postedAt`
- optional embedded `rawResult`

The action returns the new `searchId` after persistence succeeds.

## Failure handling

Files:

- `convex/searchActions.ts`
- `convex/searchFailure.ts`
- `convex/searchFacets.ts`
- `convex/searchAi.ts`
- `convex/searchTavily.ts`
- `convex/search.ts`

The action tracks the current pipeline stage in `currentStage`. That allows failures to be saved with a useful stage label even when the underlying error is generic.

Current stages include:

- `runtime-config`
- `prompt-analysis`
- `tavily-search`
- `job-structuring`
- `search-processing`
- `search-persistence`

Specialized failures are wrapped in `SearchStageError`, which can carry:

- `stage`
- `message`
- `underlyingErrorName`
- `responseText`
- `details`
- `tavilyRequestId`

When an error is caught, `submitSearch` converts it into a persistable `failureTrace` and tries to save a failed `searchRuns` row with:

- `status: 'failed'`
- `summary` explaining that the search failed
- zero jobs
- the best known query context (`prompt`, optional `tavilyQuery`)
- optional `failureTrace`

If that persistence also fails, the action logs the save failure to the server console and still rethrows an error back to the client.

The client does **not** navigate to a saved failed-results page automatically. It still receives an error message, while the failure is preserved internally for debugging.

## Public vs admin visibility

Files:

- `convex/search.ts`
- `src/routes/admin.tsx`

The persistence layer stores more than the public results page returns.

### Public results query

`getSearchResultPage` strips:

- `search.failureTrace`
- `job.rawResult`

So regular users only see the cleaned search and job payload.

### Admin query

`getAdminSearchRuns` keeps:

- failed search traces
- embedded raw-result evidence on jobs

It also has a legacy fallback for older runs whose jobs do not already carry embedded raw evidence.

## Key files

- `convex/searchActions.ts`  
  Main orchestration for `submitSearch`.

- `convex/searchEnv.ts`  
  Runtime environment validation.

- `convex/searchFacets.ts`  
  First AI pass: prompt analysis.

- `convex/searchQueryBuilder.ts`  
  Deterministic Tavily query construction.

- `convex/searchTavily.ts`  
  Tavily request execution and response normalization.

- `convex/searchAi.ts`  
  Second AI pass: convert Tavily results into structured jobs.

- `convex/searchNormalize.ts`  
  Shared normalization for categories, raw results, and saved jobs.

- `convex/searchFailure.ts`  
  Shared failure-tracing utilities and `SearchStageError`.

- `convex/search.ts`  
  Internal persistence and read models for public and admin views.

- `src/routes/index.tsx` and `src/components/results-shell.tsx`  
  Frontend call sites that invoke `submitSearch` and navigate using the returned `searchId`.

## In one sentence

`submitSearch` is the orchestration layer that turns a raw prompt into either a saved non-job-search classification, a saved completed job-search result set, or a saved failed search trace.
