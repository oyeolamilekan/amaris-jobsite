# Copilot instructions for this repository

## Commands

- Use `bun run ...` for project scripts. This repo has a `bun.lock` file.
- `bun run dev` starts the full local stack: it runs `npx convex dev --once`, then starts the Vite app and Convex dev process together.
- `bun run dev:web` starts only the Vite dev server on port `3000`.
- `bun run dev:convex` starts the Convex dev process.
- `bun run dev:ts` runs TypeScript in watch mode.
- `bun run build` runs the production build to `dist/` with `vite build && tsc --noEmit`.
- Vite 7 in this repo expects Node `20.19+` or `22.12+`; older Node 20 releases warn during build.
- `bun run lint` runs `tsc` and ESLint with `--max-warnings 0`.
- `bun run format` runs Prettier across the repo.
- There is currently no project test runner configured: no `test` script exists in `package.json`, and there are no project test files under `src/`, `convex/`, or `public/`. There is therefore no single-test command yet.
- A `start` script exists, but it currently points to `.output/server/index.mjs` while `bun run build` emits `dist/server/server.js`. Verify the runtime entrypoint before relying on `bun run start`.
- If you edit the root `dev` script, note that it still shells out to `npx convex` and `npm:` shortcuts inside `concurrently`; keep that behavior consistent or migrate it deliberately.

## High-level architecture

- This is a TanStack Start app backed by Convex. The frontend lives under `src/`; the backend schema and functions live under `convex/`.
- Routing is file-based. Add pages under `src/routes/`. `src/routes/__root.tsx` owns the document shell, metadata, favicon links, and global stylesheet import.
- `src/router.tsx` is the main integration point: it creates a `ConvexQueryClient` from `VITE_CONVEX_URL`, connects it to a React Query `QueryClient`, then wraps the TanStack router with both `routerWithQueryClient(...)` and `ConvexProvider`.
- Route components use React Query + Convex together. Read data with `useSuspenseQuery(convexQuery(api.someModule.someQuery, args))`; write data with `useMutation(api.someModule.someMutation)`; invoke actions with `useAction(api.someModule.someAction)`.
- The Convex data model is defined in `convex/schema.ts`. Client-facing function references come from `convex/_generated/api`, and server-side registrations come from `convex/_generated/server`.
- Styling is Tailwind CSS v4. Global styles are in `src/styles/app.css` and imported from the root route with `?url`; most component styling is done with inline utility classes in route components.

## Key conventions

- Do not edit generated files. In this repo that includes `src/routeTree.gen.ts` and everything under `convex/_generated/`.
- Use the `~/*` path alias for imports from `src/*`.
- The app expects `VITE_CONVEX_URL` to exist in the environment. If it is missing, `src/router.tsx` logs an error and Convex-backed queries will not work.
- Follow the Convex patterns already used here and documented in `.cursor/rules/convex_rules.mdc`:
  - Register public functions with `query`, `mutation`, and `action` from `./_generated/server`.
  - Always define `args` validators with `v.*`.
  - Call other Convex functions with `ctx.runQuery`, `ctx.runMutation`, or `ctx.runAction` using `api`/`internal` references instead of direct function calls.
  - If an action needs Node.js built-ins, move it into an action-only file with `"use node";`; do not mix that with queries or mutations in the same file.
- Frontend reads are expected to go through the React Query bridge (`convexQuery` + `useSuspenseQuery`) rather than plain Convex `useQuery`.
- ESLint uses `@tanstack/eslint-config` and `@convex-dev/eslint-plugin`; `convex/_generated` is intentionally ignored there.
- Prettier formatting in this repo uses no semicolons, single quotes, and trailing commas.
