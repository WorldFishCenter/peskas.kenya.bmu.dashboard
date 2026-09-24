---
paths:
  - "packages/nosql/**"
---

# packages/nosql (Mongoose schemas)

- Collections here fall into two groups:
  - **Written by `peskas.kenya.data.pipeline`** (`export_summaries()` in `R/export.R`, names under
    `dashboard_wcs.collections.v1` in its `inst/config.yml`): `catch_monthly`,
    `fish_distribution`, `individual_stats`, `individual_fish_distribution`,
    `individual_gear_stats`, `gear_summaries`. Changing a field name or type here means changing
    the pipeline in the same piece of work, or the dashboard silently reads `undefined`.
  - **Not in the pipeline config**: auth models (`schema/auth.ts`), `bmu`, `app_usage_sessions` (written by this app or by hand).
- Define models with the reuse guard so hot reload doesn't re-register them:
  `(mongoose.models.X as mongoose.Model<T>) ?? mongoose.model<T>('X', schema)`, and set
  `collection:` explicitly to the name the pipeline writes.
- `getDb()` in `src/index.ts` caches one connection on `global.mongoose` and throws at import if
  `MONGODB_URI` is unset.
- Migrations use `ts-migrate-mongoose`: `pnpm --filter @repo/nosql run generate` / `run migrate`.
