---
paths:
  - "packages/api/**"
---

# packages/api (tRPC)

- Add a router in `src/router/`, export it from `src/router/index.ts`, and register it in
  `appRouter` in `src/root.ts`. Clients call it as `api.<router>.<procedure>`.
- Validate every input with Zod. Pick the narrowest procedure: `protectedProcedure` for data,
  `adminProcedure` for admin-only operations (see `.claude/rules/rbac.md`).
- `await getDb()` (default export of `@repo/nosql`) before querying a model, and return plain
  objects (`.lean()`), not Mongoose documents.
- BMU names are spelled inconsistently across collections. Build every BMU filter with
  `getAllBmuVariants(bmus)` from `src/utils/bmu-normalizer.ts`. Display formatting is separate
  (`bmu-display-normalizer.ts` in the app); don't duplicate normalization in a router.
- Tests: `vitest run` (`pnpm --filter @isomorphic/api test`); `src/utils/bmu-normalizer.test.ts`
  is the pattern.
- `@trpc/*` is pinned to a v11 beta across the app and this package; bump all of them together.
