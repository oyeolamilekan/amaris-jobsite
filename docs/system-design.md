# System design diagram

This page shows how data moves through Amaris across the browser UI, Convex backend, persistent data stores, and external services.

For the narrative explanations, see [../README.md](../README.md), [./backend.md](./backend.md), and [./frontend.md](./frontend.md).

## System overview

```mermaid
flowchart LR
    user([User]) --> home["Landing page /"]
    admin([Admin user]) --> adminRoute["Admin dashboard /lover-side"]

    subgraph Frontend["TanStack Start frontend"]
        router["src/router.tsx<br/>ConvexQueryClient + React Query + Better Auth"]
        home["Landing page /"]
        loading["Search loading screen"]
        results["Results route /results"]
        peopleDialog["LinkedIn people dialog"]
        signIn["Sign-in route /sign-in"]
        adminRoute["Admin dashboard /lover-side"]
    end

    subgraph Convex["Convex backend"]
        initSearch["search.progress.initSearch"]
        getProgress["search.progress.getSearchProgress"]
        submitSearch["search.actions.submitSearch"]
        refreshResults["search.actions.refreshSearchResultsAvailability"]
        getResults["search.queries.getSearchResultPage"]
        ensurePeople["linkedin.actions.ensureLinkedInPeopleForJob"]
        getPeople["linkedin.queries.getLinkedInPeopleSearchForJob"]
        getCurrentUser["auth.getCurrentUser"]
        adminQueries["Admin search, LinkedIn, and settings queries"]
        searchPipeline["search/pipeline.ts<br/>classify -> Tavily -> availability check -> extract -> normalize -> save"]
        linkedinPipeline["linkedin/queryBuilder.ts + linkedin/parse.ts<br/>Tavily lookup -> parse -> save"]
    end

    subgraph Stores["Convex data stores"]
        searchProgress[("searchProgress")]
        searchRuns[("searchRuns")]
        jobResults[("jobResults")]
        linkedinSearches[("linkedinPeopleSearches")]
        adminSettings[("adminSettings")]
        authTables[("Better Auth tables")]
    end

    subgraph External["External services"]
        tavily["Tavily"]
        aiGateway["AI Gateway models"]
        googleOAuth["Google OAuth"]
    end

    router --> home
    router --> results
    router --> signIn
    router --> adminRoute

    home -->|create progress row| initSearch
    home -->|start long-running search| submitSearch
    loading -->|subscribe to stage updates| getProgress
    initSearch -->|insert| searchProgress
    getProgress -->|read| searchProgress

    submitSearch -->|load selected model| adminSettings
    submitSearch --> searchPipeline
    searchPipeline -->|generate query + extract job metadata| aiGateway
    searchPipeline -->|retrieve live listings| tavily
    searchPipeline -->|patch progress| searchProgress
    searchPipeline -->|insert search summary| searchRuns
    searchPipeline -->|insert normalized jobs| jobResults

    results -->|revalidate saved links| refreshResults
    refreshResults -->|read and prune| jobResults
    refreshResults -->|remove orphaned people lookups| linkedinSearches
    results -->|load saved search page| getResults
    getResults -->|read| searchRuns
    getResults -->|read ranked jobs| jobResults

    peopleDialog -->|trigger on demand| ensurePeople
    peopleDialog -->|load cached result| getPeople
    ensurePeople --> linkedinPipeline
    linkedinPipeline -->|search public profiles| tavily
    linkedinPipeline -->|read job context| jobResults
    linkedinPipeline -->|upsert cached people| linkedinSearches
    getPeople -->|read| linkedinSearches

    signIn -->|start social sign-in| googleOAuth
    signIn -->|session and user storage| authTables
    adminRoute -->|server-side access check| getCurrentUser
    getCurrentUser -->|read| authTables
    adminRoute -->|load admin views| adminQueries
    adminQueries -->|read| searchRuns
    adminQueries -->|read| jobResults
    adminQueries -->|read| linkedinSearches
    adminQueries -->|read/update| adminSettings
```

## Main search request flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant P as searchProgress
    participant A as submitSearch action
    participant T as Tavily
    participant M as AI Gateway
    participant D as searchRuns + jobResults

    U->>F: Enter prompt and submit search
    F->>P: initSearch(prompt)
    P-->>F: progressId
    F->>A: submitSearch(prompt, progressId, selectedProviders)
    A->>P: update stage = analyzing
    A->>M: classify prompt and build search query
    alt Not a job search
        A->>D: save searchRuns status = not_job_search
        A->>P: update stage = completed
        A-->>F: searchId
    else Valid job search
        A->>P: update stage = searching
        A->>T: retrieve provider-scoped listings
        A->>M: extract structured job metadata per result
        A->>D: save searchRuns + jobResults
        A->>P: update stage = completed
        A-->>F: searchId
    end
    F->>D: getSearchResultPage(searchId)
    D-->>F: saved search + ranked jobs
```

## How to read the diagram

- **Frontend** initiates and renders flows, but long-running work is pushed into **Convex actions**.
- **Convex tables** are the source of truth for saved searches, job results, progress state, LinkedIn lookups, admin settings, and auth records.
- **Tavily** provides live retrieval, while **AI Gateway models** handle prompt classification and per-job extraction.
- **Google OAuth** is only part of the authentication path; it is not involved in the search pipeline itself.

## Key data paths

1. **Search creation** writes `searchProgress`, then `searchRuns` and `jobResults`.
2. **Results rendering** reads `searchRuns` and `jobResults`, and may prune stale jobs through the availability refresh action.
3. **LinkedIn enrichment** reads a saved job from `jobResults`, calls Tavily, and upserts `linkedinPeopleSearches`.
4. **Admin access** first checks auth state, then reads search, LinkedIn, and settings data from Convex.
