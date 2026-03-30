# Convex Backend

Backend functions for the job search application, organized by domain.

## Folder structure

```
convex/
├── _generated/          # Auto-generated (do NOT edit)
├── schema.ts            # Database schema definition
├── shared/              # Cross-feature utilities
│   ├── constants.ts     # Enums, limits, status values
│   ├── env.ts           # Runtime config (API keys, feature flags)
│   ├── model.ts         # AI model initialization
│   ├── prompts.ts       # LLM system prompts
│   ├── schemas.ts       # Zod schemas for AI structured output
│   ├── validators.ts    # Convex argument/return validators
│   ├── failure.ts       # Error handling utilities
│   └── tavily.ts        # Tavily search API client
├── search/              # Job search feature
│   ├── actions.ts       # Public action: submitSearch
│   ├── pipeline.ts      # Search orchestration pipeline
│   ├── facets.ts        # AI-powered search query generation
│   ├── extract.ts       # Job detail extraction from search results
│   ├── normalize.ts     # Result normalization and deduplication
│   ├── queries.ts       # DB queries and mutations for search results
│   └── progress.ts      # Real-time search progress tracking
└── linkedin/            # LinkedIn people search feature
    ├── actions.ts       # Public action: ensureLinkedInPeopleForJob
    ├── parse.ts         # Deterministic LinkedIn title parsing
    ├── normalize.ts     # People result normalization
    ├── queryBuilder.ts  # Tavily query construction for LinkedIn
    └── queries.ts       # DB queries and mutations for people searches
```

## API routing

Convex maps file paths to API references:
- `convex/search/actions.ts` → `api.search.actions.submitSearch`
- `convex/search/progress.ts` → `api.search.progress.getSearchProgress`
- `convex/search/queries.ts` → `api.search.queries.getSearchResultPage`
- `convex/linkedin/actions.ts` → `api.linkedin.actions.ensureLinkedInPeopleForJob`
- `convex/linkedin/queries.ts` → `api.linkedin.queries.getLinkedInPeopleSearchForJob`

## Key patterns

- **Queries/mutations** use validators from `shared/validators.ts`
- **Actions** orchestrate external API calls (Tavily, OpenAI) and call internal mutations to save results
- **Progress tracking** uses Convex's real-time subscriptions for live UI updates
- Read data on the frontend with `useSuspenseQuery(convexQuery(api.search.queries.*, args))`
- Write data with `useMutation(api.search.progress.initSearch)` or `useAction(api.search.actions.submitSearch)`
