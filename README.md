# Amaris

Amaris is an AI-assisted job search app built with **TanStack Start** on the frontend and **Convex** on the backend. A user enters a natural-language prompt, the backend turns it into a provider-scoped live search, extracts structured job data, saves the results, and can enrich a saved role with LinkedIn-discoverable people related to the hiring company.

## Documentation

- [System design diagram](./docs/system-design.md)
- [Backend documentation](./docs/backend.md)
- [Frontend documentation](./docs/frontend.md)

## What the app does

- turns free-form job prompts into search-ready queries
- searches approved ATS and careers-site providers through Tavily
- extracts and ranks saved jobs with AI-assisted metadata
- rechecks saved job links before showing results
- lets users open a LinkedIn people dialog for a saved job/company
- exposes an admin dashboard for search runs, LinkedIn lookups, and AI model settings

## Architecture at a glance

| Layer | Main responsibilities | Key files |
| --- | --- | --- |
| Frontend | routing, forms, loading states, results rendering, auth UI, admin UI | `src/router.tsx`, `src/routes/*`, `src/components/*` |
| Backend | schema, persistence, search workflows, LinkedIn enrichment, auth, admin settings | `convex/schema.ts`, `convex/search/*`, `convex/linkedin/*`, `convex/auth.ts` |
| External services | model access, live web retrieval, Google sign-in | AI Gateway, Tavily, Google OAuth |

## End-to-end search flow

1. The user submits a prompt from `/`.
2. The frontend creates a `searchProgress` record and starts `api.search.actions.submitSearch`.
3. The backend classifies the prompt, runs the provider-scoped Tavily search, filters dead links, extracts structured metadata, and saves the search run plus job results.
4. The frontend navigates to `/results`, refreshes saved job availability, and loads the saved search data.
5. If the user opens the LinkedIn dialog, the frontend triggers `api.linkedin.actions.ensureLinkedInPeopleForJob` and reads the cached result back through a query.

## Repository layout

```text
.
├── src/                    # TanStack Start frontend
├── convex/                 # Convex backend, auth, and schema
├── docs/
│   ├── backend.md
│   ├── frontend.md
│   └── system-design.md
├── public/                 # Static assets
└── package.json            # Scripts and dependency manifest
```

## Tech stack

| Category | Tools |
| --- | --- |
| Frontend | React 19, TanStack Start, TanStack Router, React Query, Tailwind CSS |
| Backend | Convex, Better Auth |
| AI/search | `ai` SDK, AI Gateway models, Tavily |
| Tooling | Bun, TypeScript, Vite, ESLint, Prettier |

## Getting started

### Prerequisites

- **Bun** for package management and scripts
- **Node 20.19+ or 22.12+** for the Vite 7 toolchain
- a **Convex deployment**
- **Google OAuth credentials** if you want sign-in enabled
- **AI Gateway** and **Tavily** API keys for the search features

### Install

```bash
bun install
```

### Configure environment variables

Create your local environment file and set the variables used by the app.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_CONVEX_URL` | yes | Convex deployment URL used by the frontend and auth server helpers |
| `VITE_CONVEX_SITE_URL` | yes | site URL used by Better Auth React Start helpers |
| `AI_GATEWAY_API_KEY` | yes | authenticates AI-assisted query generation and job extraction |
| `TAVILY_API_KEY` | yes | authenticates live web retrieval |
| `SITE_URL` | yes | Better Auth base URL |
| `GOOGLE_CLIENT_ID` | yes | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | yes | Google OAuth client secret |
| `VITE_SITE_URL` | optional | public site URL override used for SEO metadata |

## Development commands

```bash
bun run dev         # full local stack
bun run dev:web     # Vite dev server only
bun run dev:convex  # Convex dev process only
bun run build       # production build
bun run lint        # TypeScript + ESLint
bun run format      # Prettier
```

There is currently **no project test runner configured** in `package.json`.

## Auth and roles

- Google sign-in is exposed through Better Auth.
- New users default to the `standard` role.
- The `/lover-side` admin dashboard requires a user with role `admin`.

## License

This project is licensed under the [MIT License](./LICENSE).

## Contributor notes

- Do not edit generated files such as `src/routeTree.gen.ts` or anything under `convex/_generated/`.
- Prefer the `~/*` import alias for `src/*`.
- Frontend reads are typically written with `convexQuery(...)` plus React Query.
- Convex actions are used for workflows that call external services or take longer than a normal query or mutation.
