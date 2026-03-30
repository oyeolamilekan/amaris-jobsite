<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Backend structure (`convex/`)

Modules are grouped by domain into three folders:

- **`shared/`** – Cross-feature config, environment, types, validators, AI model setup
  - `constants.ts`, `env.ts`, `model.ts`, `prompts.ts`, `schemas.ts`, `validators.ts`, `failure.ts`, `tavily.ts`
- **`search/`** – Job search feature (queries, actions, pipeline, extraction, normalization, progress)
  - `actions.ts`, `pipeline.ts`, `facets.ts`, `extract.ts`, `normalize.ts`, `queries.ts`, `progress.ts`
- **`linkedin/`** – LinkedIn people search feature
  - `actions.ts`, `parse.ts`, `normalize.ts`, `queryBuilder.ts`, `queries.ts`

Root-level: `schema.ts` (Convex convention).

### API path convention

Convex uses file-based routing into subdirectories:
- `convex/search/actions.ts` → `api.search.actions.*` / `internal.search.actions.*`
- `convex/linkedin/queries.ts` → `api.linkedin.queries.*` / `internal.linkedin.queries.*`
