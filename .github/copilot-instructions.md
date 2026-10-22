# FinTracker project instructions

FinTracker is a private household finance application with a Chinese interface,
a Next.js static frontend, a separate TypeScript API, and PostgreSQL via Prisma.
Microsoft sign-in uses MSAL in the browser and bearer-token validation in the API.

## Sources of truth

- Read [README.md](../README.md) for setup, financial semantics, authentication,
  private import/recovery, and deployment.
- Treat [the Prisma schema](../prisma/schema.prisma) and
  [migration history](../prisma/migrations/) as the database contract.
- Use [shared finance helpers and schemas](../shared/finance.ts) for financial
  calculations and validation rather than duplicating rules.
- The current product tracks monthly income/spending and independent asset
  valuations. Do not assume daily transactions, bank connections, AI, or budgets
  exist or add them without an explicit requirement.

## Architecture and conventions

- Keep static routes in [app/](../app/), shared interface code in
  [components/](../components/), browser integration in [lib/](../lib/), and
  shared domain contracts in [shared/](../shared/).
- Keep server-side data access and API handlers in [api/src/](../api/src/).
  Reuse [the Prisma client](../api/src/db.ts) and
  [the household service](../api/src/service.ts); the frontend must not query
  the database or depend on Next.js server routes.
- Reuse [the finance interface](../components/finance-app.tsx) and
  [existing global styles](../app/globals.css). Preserve strict TypeScript and
  the existing import aliases.
- Preserve static export, trailing-slash routes, and the configured base path
  in [next.config.ts](../next.config.ts). The default is `/FinTracker`, including
  local development; keep navigation and sign-in redirects base-path-aware.
- Use [the browser client](../lib/client.ts) for authenticated API calls.
  Preserve the signed-out landing page and session-restoration flow; do not
  expose financial controls or fabricated records before authentication.

## Financial data

- Reuse the money helpers in [shared/finance.ts](../shared/finance.ts). Current
  inputs support at most two decimal places; calculate minor units with
  `BigInt`, persist them as PostgreSQL `BIGINT`, and use string `amountMinor`
  values at JSON boundaries. Do not introduce floating-point money arithmetic.
- Preserve the distinction between blank/unrecorded and explicit zero.
  Income and expense completeness are independent; savings rates require
  complete records and positive income.
- Shared spending counts once. Monthly income and expenses do not change
  asset balances; property and vehicle values are not duplicate subtotals.
- Valuation updates affect only selected accounts. Reports use the latest known
  balance on or before the requested date and retain its original date;
  missing balances remain unknown, not zero.
- Preserve history when archiving. A disposal requires a zero valuation rather
  than silently removing historical balances.
- Retain transactional writes, version checks, and stale-update conflicts.
  Add focused regression tests when changing calculations, completeness,
  valuation selection, imports, or concurrency.

## Authentication and data isolation

- Reuse [API token validation](../api/src/auth.ts) and enforce household scope
  and ownership through [the service](../api/src/service.ts) on every financial
  read or mutation. UI visibility and CORS are not authorization.
- Preserve Microsoft access-token validation and server-side identity
  allowlisting. Do not substitute email addresses for immutable identities,
  accept ID/Graph tokens as API tokens, or add authentication bypasses.
- Keep database URLs, credentials, identity allowlists, and financial records
  out of source control, logs, and public build output. `NEXT_PUBLIC_*`
  variables are public; never place backend secrets in them.

## Private imports and recovery

- Reuse [normalization](../scripts/normalize.ts) and
  [the importer](../api/src/import.ts). Keep source inputs and generated
  financial files outside the repository; imports never run in a Pages build.
- Preserve stable identities, source provenance, deduplication, explicit
  conflict review, idempotent imports, and manually edited records.
- Do not silently correct source totals or load derived subtotals as assets.
  Keep backup/export authenticated and verify recovery on a separate database.

## Commands and validation

Use Node.js 22+ and pnpm 9. Preserve [pnpm-lock.yaml](../pnpm-lock.yaml).
Commands are defined in [package.json](../package.json):

```text
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
pnpm check:public
pnpm api:build
```

- Start with focused tests using `pnpm exec vitest run <test-path>`.
  Tests are colocated as `*.test.ts` and `*.test.tsx`; follow
  [vitest.config.ts](../vitest.config.ts).
- Run relevant checks for code changes. Follow the
  [Pages workflow](workflows/pages.yml) for frontend validation and public-output
  checks. Documentation-only changes need link/command checks and
  `git diff --check`, not dependency installation or an application build.
- For database changes, update the schema and add a migration; use
  `pnpm db:generate` and the documented `pnpm db:migrate` deployment flow.
  Do not replace migration history with `db push`, reset a shared database,
  or run imports/migrations against it without explicit approval.
- Preserve the deployment split: the [Pages workflow](workflows/pages.yml)
  publishes only `out/`; the manual [API workflow](workflows/api.yml) packages
  and deploys the backend separately. Follow the README's existing-host option
  when applicable. Do not provision resources or change hosting incidentally.
