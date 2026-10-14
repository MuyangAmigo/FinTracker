# FinTracker

A small household finance app: Chinese interface, monthly income and account
spending, independent asset valuations, and shared reports for two people.

**Financial records live in PostgreSQL, never in this public repository or in
GitHub Pages files.** There are no daily transactions, bank connections, AI, or
budget features.

## Architecture

- **Interface:** Next.js static export, React, TypeScript, and GitHub Pages.
- **API:** Azure Functions v4 / TypeScript. Every finance request requires a
  Microsoft access token and server-side household authorization.
- **Database:** PostgreSQL with Prisma migrations.
- **Sign-in:** MSAL authorization-code flow with PKCE, including Microsoft
  personal accounts. Only two configured identities can access the household.

GitHub Pages hosts public application code, not private data. It cannot run a
database or a server API. Without configured authentication/backend, the site
shows a setup notice and does not pretend to contain or save records.

## Development

Use Node.js 22+ and pnpm 9:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

The default site path is `/FinTracker/`, including locally. Set
`NEXT_PUBLIC_BASE_PATH` to an empty string before building if deploying at a
domain root.

Copy `.env.example` to `.env.local` and provide the public API/client settings.
Never put a client secret, database URL, or Function key in a `NEXT_PUBLIC_*`
variable. The frontend build does not need or query the finance database.

### Local API and database

Install Azure Functions Core Tools v4 and use PostgreSQL. Copy
`api/local.settings.example.json` to `api/local.settings.json`; this file is
ignored. Set the database URL and the allowed identity tuples:
`tenantId`, `objectId`, and the imported database `personId`.

```powershell
$env:DATABASE_URL = 'YOUR_PRIVATE_DATABASE_URL'
pnpm db:migrate
pnpm api:dev
```

An optional development-only PostgreSQL launcher is included when PostgreSQL is
not installed. It binds only to loopback, requires a password, uses UTF-8, and
persists files outside the repository:

```powershell
$env:LOCAL_DATABASE_DIR = 'C:\private\fintracker-db'
$env:LOCAL_DATABASE_PASSWORD = 'SET_A_PRIVATE_RANDOM_PASSWORD'
pnpm db:local
```

Stop the command after use. It does not provision Azure resources or create OS
users. Keep the password in private local configuration, not source code.

## Monthly records and assets

- Add income sources, accounts, owners, and asset items from the interface.
- One month/account or month/income-source row represents the monthly amount.
  Blank is unrecorded; `0.00` is explicitly recorded zero.
- Mark income and expenses complete independently. Partial months are labelled;
  savings rates require complete records and positive income.
- Shared spending counts once. It is not split automatically between people.
- Monthly income and expenses never change asset balances.
- Valuations can update selected accounts only. Omitted accounts are not reset.
- Reports use each account's latest known balance on or before the selected
  period and show the original valuation date. Missing balances are unknown.
- Property and vehicle values are assets, not duplicate financial subtotals.
- Archiving retains history and nonzero balances. A disposal needs a zero
  valuation; historical asset reporting cannot be silently disabled.
- Concurrent saves use versions. A stale update returns a conflict rather than
  overwriting the other person's work.

## Private import and recovery

All source inputs and generated financial files must be outside the repository.
The importer never runs as part of a Pages build.

```powershell
pnpm data:normalize --csv-dir C:\private\csv --supplement C:\private\supplement.json --out C:\private\dataset.json --report C:\private\normalization.json
pnpm data:import --input C:\private\dataset.json --report C:\private\reconciliation.json --check-only
$env:DATABASE_URL = 'YOUR_PRIVATE_DATABASE_URL'
pnpm data:import --input C:\private\dataset.json --report C:\private\reconciliation.json
```

The supplement contains two person names, optional account-name aliases,
monthly screenshot rows, asset-sheet rows, and property/vehicle valuations.
The schemas and synthetic tests document the format. Repeated CSV history is
deduplicated; supplied screenshot rows override older CSV values. Unresolved
CSV conflicts make normalization fail for review.

The report retains original totals and exact differences. Source formulas,
rounding, and date mismatches are not silently corrected. Derived totals are
never loaded as additional asset accounts.

Import is restartable and idempotent. It preserves manually edited months and
valuations. Exports are authenticated downloads, not public URLs. A versioned
JSON backup includes household metadata and all records and can be passed to
`data:import` to restore into a fresh migrated database. Make regular managed
PostgreSQL backups too; test recovery on a separate database before relying on it.

## Deployment

The GitHub Pages workflow publishes **only `out`**, not the checkout root.
The expected URL is `https://muyangamigo.github.io/FinTracker/`.

Set these repository variables before enabling private data access:

| Variable                | Purpose                                |
| ----------------------- | -------------------------------------- |
| `NEXT_PUBLIC_API_URL`   | Function API root, ending in `/api`    |
| `NEXT_PUBLIC_CLIENT_ID` | Microsoft SPA client ID                |
| `NEXT_PUBLIC_API_SCOPE` | Exposed FinTracker API delegated scope |

Register the full Pages URL as a **SPA redirect URI**. The browser sends bearer
tokens to the API; cross-site session cookies are not required. The API validates
Microsoft signatures, issuer, audience, expiry, scope, and the allowed
tenant/object IDs. It rejects ID tokens and Graph tokens.
Set the API app registration's `requestedAccessTokenVersion` to `2`. Configure
the allowed identity tenant/object IDs from the users' validated token claims,
not from the subscription's directory ID. Personal accounts use the Microsoft
consumer tenant in their tokens.

Configure backend-only settings in the Function App: `DATABASE_URL`,
`HOUSEHOLD_ID`, `API_AUDIENCE`, `API_SCOPE`, `ALLOWED_IDENTITIES`, and
`ALLOWED_ORIGINS`. The allowed Pages origin is `https://muyangamigo.github.io`,
without `/FinTracker/`; add localhost only for development. CORS is not an
authorization mechanism.

The Functions HTTP trigger uses custom bearer-token authorization, not exposed
Function keys. Its host-level anonymous setting does **not** bypass the
application's authorization gate. OPTIONS requests perform preflight only and
return no records.

Azure deployment is separate. Confirm the **personal subscription**, region,
costs, storage, database networking, backups, and identity registrations before
creating resources. The manual backend workflow requires configured OIDC and an
approved target; do not reuse the previous App Service automatically.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:public
pnpm api:build
```

Database integration tests require `DATABASE_URL` and use an isolated synthetic
household. They do not modify the real household. CI uses a synthetic PostgreSQL
service. Only synthetic fixtures belong in public tests.

## Clean Git history

The previous repository history was replaced with a new code-only root. Old
financial files, feature branches, and legacy deployment logs were removed.
**Do not merge or push branches from an old clone:** that can reintroduce the
removed data. Use a fresh clone or carefully transfer code-only patches.

A history rewrite cannot erase downloaded copies, forks, or all GitHub cached/PR
references. The owner must contact GitHub Support for retained sensitive-data
views. No claim is made that every previously public copy has been erased.
