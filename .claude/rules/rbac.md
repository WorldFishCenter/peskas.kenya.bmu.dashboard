---
paths:
  - "apps/isomorphic-i18n/src/app/shared/analytics/**"
  - "apps/isomorphic-i18n/src/app/shared/file/dashboard/**"
  - "apps/isomorphic-i18n/src/middleware/**"
  - "apps/isomorphic-i18n/src/middleware.ts"
  - "apps/isomorphic-i18n/src/app/api/auth/**"
  - "apps/isomorphic-i18n/src/app/*/*/admin/**"
  - "packages/api/src/trpc.ts"
  - "packages/api/src/router/**"
---

# Roles and access control

## Where roles come from

`session.user.groups` (populated from the user's groups at sign-in) holds group names. The single
client-side source of truth is `useUserPermissions()`
(`apps/isomorphic-i18n/src/app/shared/analytics/core/hooks/use-user-permissions.ts`). Read roles
through it; don't re-check `groups` in components.

| Group | Flag | Sees |
|---|---|---|
| `admin` / `Admin` | `isAdmin` | all BMUs; picks a reference BMU (`adminReferenceBmuAtom`, localStorage) |
| `WBCIA` | `isWbciaUser` | all BMUs (region filtering not implemented) |
| `CIA` | `isCiaUser` | only `session.user.userBmu.BMU` |
| `AIA` | `isAiaUser` | only `userBmu`, administrative framing |
| `IIA` | `isIiaUser` | only their own records via `session.user.fisherId`, no BMU comparisons |

`referenceBMU = isAdmin ? adminReferenceBmu : userBMU`. `getAccessibleBMUs(allBMUs)` applies the
table above. A user in no known group falls through to "all BMUs".

## Dashboard routing

`src/app/[lang]/(hydrogen)/page.tsx` renders `src/app/shared/file/dashboard/index.tsx`, which
picks the view: IIA with a `fisherId` gets the individual fisher components
(`analytics/individual/`); otherwise `FileStatsAdmin`, `FileStatsWBCIA`, `FileStatsAIA`, or
`FileStats` (CIA and default). Keep role-based view selection in `file/dashboard/index.tsx`.

The metric cards map ids to `aggregatedCatch.monthly` fields: effort `mean_effort`, catch-rate
`mean_cpue`, catch-density `mean_cpua`, fisher-revenue `mean_rpue`, area-revenue `mean_rpua`,
costs `mean_cost`, profit `mean_profit`. These are `catch_monthly` columns written by the Kenya
pipeline.

## Server side

- `packages/api/src/trpc.ts`: `publicProcedure`, `protectedProcedure` (session required),
  `adminProcedure` (admin group required). Use `adminProcedure` for admin-only procedures instead
  of repeating the group check.
- Data procedures take `bmus` / `fisherId` from the client input and do not check them against
  the session. BMU and fisher scoping is enforced only in the UI today; when you add or touch a
  data procedure, derive the allowed scope from `ctx.session.user` rather than trusting input.

## Middleware

`src/middleware.ts` composes `withJwt(withLang(defaultMiddleware))`. `withJwt` only checks that a
cookie whose name contains `next-auth.session-token` exists; it redirects to `/{lang}/sign-in`
without one and away from `sign-in` / `forgot-password` / `reset-password` with one. It does not
validate the token. The `matcher` lists the paths the middleware runs on; keep it in step with
`languages` in `src/app/i18n/settings.ts`.
