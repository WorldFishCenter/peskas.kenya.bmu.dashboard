# peskas.kenya.bmu.dashboard

Kenya WCS BMU dashboard with role-based access, built on the Isomorphic Next.js
template as a pnpm + Turborepo monorepo (Next 15, tRPC 11 beta, Mongoose, NextAuth v4). It reads
the Mongo `app` / `app-dev` database written by `peskas.kenya.data.pipeline`. Ecosystem context
(other repos, data flow, cross-repo contracts): see PESKAS.md, loaded via CLAUDE.local.md.

## Commands

- `pnpm run i18n:dev` (port 3001), `pnpm run i18n:build`, `pnpm run i18n:lint`: the production app.
  Root `pnpm run dev|build|lint` runs every app through turbo; see root `package.json`.
- Tests: `vitest run` via `pnpm --filter i18n test` and `pnpm --filter @isomorphic/api test`.
  Coverage is thin (`*.test.ts` next to the BMU normalizers); lint and build are the main checks.
- Type check a package: `pnpm --filter <pkg> typecheck` or `npx tsc --noEmit` in its directory.
- `pnpm run clean` clears turbo caches and `node_modules` when builds go stale.

## Architecture

- **`apps/isomorphic-i18n` (package name `i18n`) is the only production app.** `apps/isomorphic`
  and `apps/isomorphic-starter` are template leftovers; don't edit them for product work.
- `packages/api` (`@isomorphic/api`): tRPC routers, combined in `src/root.ts`, served from
  `apps/isomorphic-i18n/src/app/api/trpc/`. Client hooks in `src/trpc/react.tsx`, RSC caller in
  `src/trpc/server.ts`. `trpc-openapi` generates a document in `src/openApi.ts`.
- `packages/nosql` (`@repo/nosql`): Mongoose schemas. `getDb()` (default export of
  `@repo/nosql`) caches one connection from `MONGODB_URI`; await it before any model query.
- `packages/isomorphic-core`: shared UI (RizzUI, Tailwind, some Radix primitives).
- Only the **Lithium** layout ships, hard-coded in `src/app/[lang]/(hydrogen)/layout.tsx`; its
  sidebar reuses `src/layouts/hydrogen/menu-items.tsx` and `sidebar.tsx`.
- i18n: languages `en` and `sw` (`src/app/i18n/settings.ts`), every route under `[lang]`, strings
  in `src/app/i18n/locales/{en,sw}/`.
- Auth: NextAuth with **JWT sessions** (not database sessions) and a **custom Mongoose adapter**
  (`src/app/api/auth/[...nextauth]/mongoose-adapter.ts`), config in `auth-options.ts`.
  Credentials (bcrypt; session 1 day, 30 days with remember-me) plus optional Google OAuth.

## Roles

Group names on `session.user.groups` decide the view (detail in `.claude/rules/rbac.md`):
`admin`/`Admin` sees all BMUs and picks a reference BMU; `WBCIA` sees all BMUs (region filter not
built); `CIA` and `AIA` are locked to `user.userBmu`; `IIA` is an individual fisher who sees only
their own data via `user.fisherId`. Read roles through `useUserPermissions()` on the client and
`adminProcedure` / `ctx.session.user` on the server.

## Rules

- Add every user-facing string to both `en` and `sw` locale files in the same change.
- Treat a schema change in `packages/nosql` for a pipeline-written collection (catch, gear, fish
  distribution, individual stats) as a change in `peskas.kenya.data.pipeline` too: those
  collections come from its `export_summaries()` (`R/export.R`, names under
  `dashboard_wcs.collections.v1` in its `inst/config.yml`).
- Filter by BMU through `getAllBmuVariants()` (`packages/api/src/utils/bmu-normalizer.ts`);
  never match raw BMU names.
- Release: add a `# peskas.kenya.bmu.dashboard X.Y.Z` block at the top of `NEWS.md`. A push to **`dev`** (not
  `main`) turns it into a GitHub release (`.github/workflows/release.yaml`).

## Gotchas

- Env vars: `turbo.json` passes `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `MONGODB_URI`, `VERCEL_URL`,
  `VERCEL`, `EMAIL_FROM`, `EMAIL_SERVER`. `src/env.mjs` also validates optional `GOOGLE_*` and
  `SMTP_*`, which turbo does not list, so they are not part of the build cache key.
- `src/middleware.ts` only checks that a session cookie exists (`withJwt`); real authorization
  happens in `protectedProcedure` / `adminProcedure`. Never rely on the middleware for access
  control.
- Admin reference BMU and filter selections persist in localStorage (Jotai `atomWithStorage`), so
  stale values survive reloads and user switches in the same browser.
