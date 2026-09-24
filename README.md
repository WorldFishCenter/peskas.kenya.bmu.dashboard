# Peskas Kenya BMU dashboard

A dashboard that shows fishers and Beach Management Units at study sites on the Kenyan coast their own catch, earnings and fishing data.

Live at https://digitalfisheries.kenya.peskas.org (sign-in required).

## What it is

The dashboard is for fishers and Beach Management Unit (BMU) leaders at 35 landing sites in five coastal counties of Kenya: Kilifi, Kwale, Lamu, Mombasa and Tana River. It is part of a two-year study by the Wildlife Conservation Society (WCS) and WorldFish that tests whether giving fishers and their communities their own data changes how they fish and manage their fishery. It is available in English and Swahili. There is no public sign-up: an administrator creates each account and decides what it can see. If you forget your password, use "Forgot password" on the sign-in page.

## What you can do

- See your own catch rate, revenue, costs and profit month by month, if you are an individual fisher.
- See your BMU's monthly fishing effort, catch rate, revenue, costs and profit, compared with recommended levels.
- See which fishing gears are used and how well each one performs.
- See which kinds of fish make up the catch.
- Compare BMUs with each other, if your account has access to more than one.

## Where the data comes from

Enumerators on the WCS landing survey record catches at the study sites with KoboToolbox. The [Peskas Kenya data pipeline](https://github.com/WorldFishCenter/peskas.kenya.data.pipeline) checks those records, keeps the validated ones from 2023 onwards, works out monthly figures for each BMU and each fisher, and loads them into the dashboard every 2 days. The figures are as recent as the last pipeline run; they are not live.

- **BMU (Beach Management Unit)**: the community body that manages a landing site in Kenya.
- **Landing**: a boat's return to shore with its catch, recorded by an enumerator.
- **Enumerator**: a trained data collector who records landings at landing sites.
- **KoboToolbox**: the free mobile survey app enumerators use to record landings.
- **Catch rate (CPUE, catch per unit of effort)**: kilograms of fish caught per fisher per day.
- **Revenue per fisher (RPUE)**: value of the catch per fisher per day, in Kenyan shillings (KES).
- **Profit**: revenue per fisher minus fishing trip costs per fisher, per day, in KES.

## Who runs it

The dashboard was built and is run by WCS (Mombasa, Kenya) and WorldFish. For questions, write to <peskas.platform@gmail.com>.

## Part of Peskas

Peskas is WorldFish's open-source platform for monitoring small-scale fisheries (https://peskas.org).

- [Peskas Zanzibar](https://zanzibar.peskas.org), [Peskas Kenya](https://peskas-dashboard-kenya.vercel.app/en), [Peskas Mozambique](https://peskas-dashboard-mozambique.vercel.app): country dashboards
- [Peskas Timor-Leste](https://timor.peskas.org): Timor-Leste portal
- [Peskas Coasts](https://coasts.peskas.org): regional comparison across countries
- [Peskas Tracks](https://tracks.peskas.org): app for fishers to see their trips and log catches
- [Peskas Management Platform](https://validation.peskas.org): data review and download for survey teams
- [Peskas Fishery Data API](https://api.peskas.org/docs): programmatic access to landing data
- Data pipelines: [Kenya](https://github.com/WorldFishCenter/peskas.kenya.data.pipeline), [Zanzibar](https://github.com/WorldFishCenter/peskas.zanzibar.data.pipeline), [Mozambique](https://github.com/WorldFishCenter/peskas.mozambique.data.pipeline), [Timor-Leste](https://github.com/WorldFishCenter/peskas.timor.data.pipeline), [Coasts](https://github.com/WorldFishCenter/peskas.coasts)

## For developers

A pnpm + Turborepo monorepo built on the Isomorphic Next.js template: Next.js 15, tRPC, Mongoose (MongoDB) and NextAuth.

- `apps/isomorphic-i18n` (package `i18n`) is the product. `apps/isomorphic` and `apps/isomorphic-starter` are leftovers from the template; do not use them for product work.
- `packages/api`: tRPC routers. `packages/nosql`: Mongoose schemas for the collections the Kenya pipeline writes (`export_summaries()`) to the MongoDB database `app` (`app-dev` for development). A change to those collections is a change to the pipeline too. `packages/isomorphic-core`: shared UI.

### Setup

Requirements: Node.js 18.18 or later, pnpm 9 (Turborepo is installed with the project).

```bash
pnpm install
cp apps/isomorphic-i18n/.env.local.example apps/isomorphic-i18n/.env.local   # then fill it in
pnpm run i18n:dev                                                             # http://localhost:3001
```

[apps/isomorphic-i18n/.env.local.example](apps/isomorphic-i18n/.env.local.example) covers sign-in (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`) and Google keys. Also set `MONGODB_URI` (a connection string to the `app-dev` database) and, for password-reset emails, `EMAIL_SERVER` and `EMAIL_FROM`.

### Main commands

- `pnpm run i18n:dev`, `pnpm run i18n:build`, `pnpm run i18n:start`, `pnpm run i18n:lint`: the product app. The root `pnpm run dev` and `pnpm run build` run every app, template leftovers included.
- `pnpm --filter i18n test` and `pnpm --filter @isomorphic/api test`: a few unit tests (BMU name matching). Lint and build are the main checks.
- Every user-facing string goes into both `en` and `sw` under `apps/isomorphic-i18n/src/app/i18n/locales/`.

### Production and releases

The app is hosted on Vercel and reads the production `app` database, which the Kenya pipeline refreshes every 2 days. To release, add a `# peskas.kenya.bmu.dashboard X.Y.Z` block at the top of [NEWS.md](NEWS.md); a push to `dev` turns it into a GitHub release ([.github/workflows/release.yaml](.github/workflows/release.yaml)). [CONTRIBUTING.md](CONTRIBUTING.md) has the step-by-step version.

### AI-assisted work

[CLAUDE.md](CLAUDE.md) and `.claude/rules/` hold the conventions and known traps.
