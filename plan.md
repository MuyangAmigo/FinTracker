# Personal Finance Tracking Dashboard and Analysis System Plan

## Current state

The repository at `/Users/junjieli/Development/PersonalDev/FinTracker` currently contains finance data assets only. There is no application scaffold, package manifest, backend, database schema, or deployment configuration yet.

Available source data:

- `assets/csv-record-tracker/Finance 2022-2026 - Overview - Junjie.csv`
  - Monthly personal net-worth snapshots.
  - Columns evolve over time as accounts are added: Alipay, WeChat, CITI/CITIC, CMB, China Bank, ICBC, HSBC, WE Bank, ESPP, Stock, Life Insurance, Bank Deposit, Investment, totals, notes.
  - Data is wide-format by month and account, with calculated total columns.
- `assets/csv-record-tracker/Household Finance Management - 2024-2026 - Personal Finance Management - YYYY.csv`
  - Household monthly income and expense tracker for Junjie and Jin You/Jinyou.
  - Each file stores January-June and July-December in repeated month/value column pairs.
  - Income labels include salary, equity, and other income for each household member.
  - Expense labels mix shared budget categories and payment-account/card lines, with Chinese labels and some ad-hoc parenthetical notes.
  - The spreadsheet goal is a 60% savings rate.

Implication: the first implementation must include a data normalization/import layer, not just CRUD screens. The app should preserve spreadsheet lineage while moving to a clean ledger, account snapshot, budget, and investment model.

## Proposed product specification

### Product goals

Build a secure, household-oriented personal finance system for Junjie and Jin You that replaces the spreadsheet workflow while preserving historical data. The product should support fast manual entry, structured monthly tracking, web dashboards, and AI-assisted financial insights using Azure-hosted models.

### Core users and roles

- Household owner: manages household settings, categories, accounts, budgets, imports, exports, and AI insight permissions.
- Household member: submits and reviews records, updates assigned accounts, and views shared household dashboards.
- Future-ready role model: allow additional members or read-only advisors without redesigning permissions.

### Primary workflows

1. Sign in securely with MFA-capable authentication.
2. View household dashboard for the current month.
3. Submit income, expenses, transfers, investments, account balances, and notes.
4. Review budget progress, savings rate, cash flow, and net worth trends.
5. Import legacy CSV data into a staging area, map spreadsheet labels to canonical accounts/categories, validate totals, and approve migration.
6. Generate monthly and annual insights from aggregated finance data.
7. Export data back to CSV/Excel-compatible files for portability.

### Product modules

#### Design system direction

- Follow `/Users/junjieli/Development/PersonalDev/FinTracker/DESIGN.md` as the source of truth for website and dashboard visual design.
- Use the documented Stripi-inspired design language: deep navy ink, electric indigo CTAs, near-white surfaces, subtle hairlines, tight pill buttons, and an atmospheric gradient mesh on marketing/landing surfaces.
- Use thin editorial typography with negative tracking for display text. Because Sohne is proprietary, default implementation should use Inter at weight 300 with `font-feature-settings: "ss01"` as the open-source substitute unless a licensed Sohne font is provided.
- Render all money, balances, transaction amounts, percentages, and financial tables with tabular figures using `font-feature-settings: "tnum"`.
- Preserve the design token names from `design.md` in the app theme where practical: colors, typography roles, spacing, radius, button variants, cards, inputs, nav, tags, and dashboard mockup cards.
- Use the documented responsive behavior: desktop-first rich dashboard composites, simplified tablet panels, and single-panel/mobile-first forms below 768px.
- Do not introduce unrelated accent colors, non-pill primary buttons, heavy display weights, or bare-canvas marketing heroes that conflict with the design guide.

#### Dashboard

- Household overview: income, expenses, savings, savings rate, net worth, cash position, investment value.
- Month view: current month totals, recent entries, budget progress, missing records, anomalies.
- Trend view: month-over-month and year-over-year changes.
- Goal view: progress against the 60% savings target and any custom goals.
- Personal/shared split: Junjie, Jin You, and shared household views.

#### Data entry

- Quick expense entry with date, amount, currency, category, payer, account, ownership scope, merchant/payee, note, and attachment.
- Income entry for salary, equity, bonuses, other income, and reimbursements.
- Transfer entry between accounts to avoid double-counting as income or expenses.
- Account balance snapshot entry for monthly net-worth tracking.
- Investment entry for holdings, contributions, ESPP, stock value, realized/unrealized gains, and insurance value.
- Recurring records for salary, recurring bills, subscriptions, and monthly transfers.

#### Budgeting and categorization

- Canonical categories with bilingual display labels where helpful.
- Category aliases to preserve existing spreadsheet labels such as shared funds, lifestyle funds, card lines, and ad-hoc notes.
- Monthly and annual budgets by category, person, and household.
- Category mapping review UI during CSV import.

#### Analysis and insights

- Rule-based metrics: savings rate, burn rate, cash runway, net-worth growth, budget variance, category concentration, recurring spend changes.
- AI-generated summaries via Azure model deployments:
  - Monthly household financial summary.
  - Unusual spending/income changes.
  - Savings-rate improvement suggestions.
  - Natural-language Q&A over approved aggregate metrics.
  - Annual review and goal recommendations.
- Keep AI prompts scoped to necessary aggregates by default; do not send raw records unless explicitly enabled.

#### Import and migration

- Upload CSV files into an import staging table.
- Detect source format: personal overview snapshot vs household monthly management sheet.
- Normalize wide spreadsheet layout into row-level records.
- Preserve source file, row, column, original label, parsed value, and mapping status.
- Validate imported monthly totals against spreadsheet total rows/columns.
- Provide a review screen for unmapped labels, duplicate months, blank future months, and inconsistent account names.
- Allow re-running imports idempotently with a source-row hash.

## Proposed technical design

### Recommended stack

- Frontend: Next.js with React, TypeScript, App Router, server components where appropriate, and a component library such as shadcn/ui or Fluent UI.
- Backend: Next.js route handlers/server actions for the initial product; split into Azure Functions later only if background jobs or integrations grow.
- Database: Azure Database for PostgreSQL Flexible Server.
- ORM/migrations: Prisma or Drizzle; pick one during implementation based on project preference.
- Authentication: Microsoft Entra External ID or Microsoft Entra ID with invited household users, MFA/passkey support, and no local password storage.
- Hosting: Azure App Service or Azure Container Apps for the web app; Azure Static Web Apps is possible if API needs stay simple, but server-side auth, import processing, and AI orchestration fit App Service/Container Apps better.
- File storage: Azure Blob Storage for uploaded CSVs, exported reports, and future receipt attachments.
- Secrets: Azure Key Vault with managed identity.
- AI: Azure OpenAI or Azure AI Foundry model deployments accessed only from the backend.
- Observability: Application Insights, Log Analytics, structured audit logs.
- IaC: Bicep or Terraform for repeatable Azure deployment.
- CI/CD: GitHub Actions with separate development and production environments.

### High-level architecture

```text
Browser
  |
  | HTTPS, secure cookies
  v
Next.js Web App on Azure
  |-- Auth adapter / Entra token validation
  |-- Finance API and server actions
  |-- Import parser and validation jobs
  |-- Insight orchestration
  |
  | managed identity
  v
Azure services
  |-- PostgreSQL Flexible Server: canonical finance data
  |-- Blob Storage: uploads, exports, attachments
  |-- Key Vault: secrets and configuration
  |-- Azure OpenAI / AI Foundry: insight generation
  |-- Application Insights: telemetry and alerts
```

### Core domain model

Initial tables:

- `households`: household workspace and settings.
- `users`: authenticated user profile mapped to Entra subject.
- `household_memberships`: user role, status, permissions.
- `accounts`: cash, bank, wallet, credit card, brokerage, ESPP, insurance, investment, liability.
- `account_snapshots`: month-end or ad-hoc balances for net-worth tracking.
- `categories`: canonical income/expense/transfer/investment categories.
- `category_aliases`: spreadsheet labels and user-entered aliases mapped to canonical categories.
- `transactions`: row-level income, expense, transfer, adjustment, and investment cash-flow records.
- `budgets`: monthly or recurring budget targets.
- `investments`: securities, plans, or investment products.
- `holdings`: investment position snapshots.
- `imports`: uploaded source files and detected import type.
- `import_rows`: parsed source rows/cells, mapping status, validation errors, dedupe hash.
- `insight_runs`: generated insight metadata, input period, model deployment, prompt version, status.
- `insights`: persisted insight cards, recommendations, anomalies, and user feedback.
- `audit_events`: security-sensitive and finance-changing actions.

Important modeling decisions:

- Store money as integer minor units plus currency code, not floating point.
- Treat transfers separately from expenses/income.
- Separate transactions from account snapshots because the existing data contains both flow records and point-in-time asset balances.
- Preserve raw import lineage for auditability and correction.
- Use household scoping on every finance table.

### API surface

Representative endpoints/server actions:

- `GET /dashboard?period=YYYY-MM`
- `GET/POST /transactions`
- `PATCH/DELETE /transactions/:id`
- `GET/POST /accounts`
- `POST /account-snapshots`
- `GET/POST /budgets`
- `POST /imports`
- `GET /imports/:id/review`
- `POST /imports/:id/apply-mappings`
- `POST /imports/:id/commit`
- `POST /insights/monthly`
- `GET /insights?period=YYYY-MM`
- `POST /exports/csv`

### Security design

- Require authentication for all application routes and APIs.
- Prefer Entra-backed MFA/passkeys over local passwords.
- Enforce household membership authorization on every request.
- Use secure, HTTP-only, SameSite cookies.
- Use CSRF protection for mutating requests if cookie-based auth is used.
- Apply strict input validation with shared schemas.
- Use database constraints and app-level authorization; evaluate PostgreSQL row-level security for defense in depth.
- Encrypt data in transit and at rest using Azure-managed capabilities.
- Store secrets in Key Vault only; access with managed identity.
- Record audit events for login, import, export, transaction changes, budget changes, account changes, insight generation, and admin changes.
- Add rate limits for auth-adjacent and AI endpoints.
- Back up PostgreSQL and test restore procedures.

### Azure deployment design

Minimum production environment:

- Azure Resource Group
- App Service or Container Apps environment
- PostgreSQL Flexible Server with private networking where practical
- Blob Storage account with private containers
- Key Vault
- Application Insights + Log Analytics
- Azure OpenAI / AI Foundry model deployment
- Entra External ID / app registration
- GitHub Actions deployment identity using OIDC

Cost-control defaults:

- Start with small compute/database SKUs.
- Use scheduled or manual AI insight generation rather than automatic generation on every record change.
- Store insight inputs as compact aggregates.
- Add alerts for spend, model token usage, failed imports, and auth anomalies.

### AI insight design

Insight generation flow:

1. Backend builds approved aggregate metrics for a household and period.
2. Prompt template combines aggregate metrics, user goals, category definitions, and prior insights.
3. Azure model returns structured JSON insight cards.
4. Backend validates the JSON schema and stores insight cards.
5. UI displays insight cards with source metrics and user feedback controls.

Guardrails:

- Default to aggregate metrics instead of raw transaction text.
- Include deterministic calculations outside the model; use the model for explanation and recommendations.
- Version prompts and store model deployment metadata.
- Validate model output strictly before saving.
- Make AI optional per household and visible when used.

## Data migration approach

### Import formats to support first

1. Personal overview snapshots:
   - Parse each `Finance YYYY - Overview - Junjie.csv`.
   - Normalize each month/account cell into an `account_snapshot`.
   - Map calculated columns such as grand total, bank deposit, investment, personal total, and cash total as derived metrics instead of source accounts.
   - Preserve notes where present.

2. Household monthly management sheets:
   - Parse repeated month/value column pairs.
   - Split income and expense sections.
   - Normalize each label/value pair into a transaction-like monthly record or budget/category aggregate.
   - Treat total, savings, and percent rows as validation rows rather than source transactions.
   - Map labels with person suffixes to owner/member and account/category aliases.

### Known data-cleaning needs

- Account names vary over time, such as CITI/CITIC naming.
- Jin You appears as both `Jin You` in requirements and `Jinyou` in spreadsheet labels.
- Some labels include Chinese category names and card/account names.
- Some labels include parenthetical amounts or status notes.
- Some future-month cells are blank.
- Totals exist in source sheets and should be used for validation, not double-counted.

## Execution and approval preferences

- During planning and implementation, proceed automatically with non-destructive local operations such as reading files, searching code, inspecting assets, creating the session plan, updating todo tracking, running existing tests/builds/lints, and making project edits needed for the approved scope.
- Ask before destructive or externally impactful operations such as deleting user data, overwriting unrelated files, force-resetting version control state, committing/pushing, provisioning Azure resources, changing paid cloud configuration, rotating secrets, deploying to production, or running commands that could mutate external systems.
- Treat Azure resource creation, model deployment, database migration against non-local environments, and production data imports as explicit-approval steps.
- Prefer reversible changes and keep legacy finance CSV files read-only unless explicitly asked to transform or relocate them.

## Implementation phases

### Status

- Phase 1 — done (commit `8068776`)
- Phase 2 — done (commit `41d15d1`)
- Phase 3 — done (commits `a8c2bc3` schema/seed code, `0f3c137` Neon migration applied)
- Phase 4 — done (commit `e7937db`); all 8 legacy CSVs import 0-error → 247 AccountSnapshot rows + 402 Transaction rows on Neon
- **Phase 8a — in progress (re-prioritized 2026-05-10): get the site live before building Phases 5–7 features**
- Phases 5, 6, 7, 8b — pending (sub-todos captured in SQL `todos` table)

### Phase 3 outcome (recap)

- Prisma 6.19.3 + PostgreSQL on Neon `ap-southeast-1` (project `ep-autumn-voice-aocw5599`)
- Full domain schema migrated: 16 models, 11 enums (`prisma/migrations/20260510124315_init`)
- Seeded: 1 household ("Junjie & Jin You"), 23 categories (bilingual: Salary/工资, Lifestyle/玩乐金, Couple fund/恋爱金, Splurge/冤大头, …), 9 import aliases, 12 accounts (Alipay, WeChat, CMB, China Bank, ICBC, CITIC, HSBC, WeBank, ESPP, Stock, Life Insurance, Investment misc)
- `lib/db.ts` HMR-safe Prisma singleton; `lib/auth/household.ts` upserts User + Household + Membership on first sign-in; `lib/auth/audit.ts` now persists to `audit_events` (best-effort, never blocks auth)
- `lib/validation/finance.ts` zod schemas for transaction / account / snapshot / budget writes
- `dotenv-cli` wired so `prisma:*` and `db:seed` scripts read `.env.local`

### Open Phase-4 questions to settle before starting

- Imports: commit raw rows on upload, or always require an explicit "approve & commit" review step? (Plan currently leans: stage → review → commit.)
- For "Salary - Junjie" style person scope, do we tag the transaction with `personTag` or assign it to a per-person account? (Plan currently leans: `personTag` only; accounts stay shared unless explicitly per-person like ESPP.)
- For the "Household Finance Management" CSVs that contain monthly totals (not individual transactions), do we materialize a synthetic transaction per month/category, or store them as a separate "MonthlyTotals" facet so we don't fake transactional data?

### Phase 1: Product and architecture baseline

- Scaffold the web application.
- Convert `DESIGN.md` into application theme tokens and shared UI primitives.
- Choose the final Next.js hosting target: App Service or Container Apps.
- Choose ORM: Prisma or Drizzle.
- Define environment configuration, secrets strategy, and local development flow.
- Create initial product navigation and UI shell.

### Phase 2: Security and household foundation

- Configure Entra-backed authentication.
- Implement user profile sync and household membership.
- Add authorization helpers and audit-event logging.
- Protect all app and API routes.

### Phase 3: Database schema and finance domain

- Implement migrations for households, members, accounts, categories, transactions, snapshots, budgets, imports, insights, and audit events.
- Add seed data for initial household members, account types, category groups, and spreadsheet aliases.
- Add data validation schemas and money utilities.

### Phase 4: Legacy data import

- Build CSV upload and staging storage.
- Implement parsers for overview and household formats.
- Add mapping UI for accounts, categories, people, and aliases.
- Validate totals and expose import errors.
- Commit approved staged rows into canonical tables.

### Phase 5: Manual tracking experience ✓ DONE

**Status:** Shipped on branch `muyangamigo/phase-5-manual-tracking` (commit
`878ce70`). `pnpm lint` / `pnpm test` (48 tests) / `pnpm build` all clean.

What landed:

- Shared dashboard chrome at `app/dashboard/layout.tsx` with a client
  sidebar (`components/dashboard/sidebar-nav.tsx`) that highlights the
  active route via `usePathname()`. Nav items: Overview, Transactions,
  Snapshots, Budgets, Imports, Audit.
- Pure aggregate helpers at `lib/finance/period.ts` (UTC-anchored
  month-range math) and `lib/finance/aggregates.ts`
  (`monthlyIncomeExpenseSavings`, `monthlyTotalsByCategory`,
  `lookupCategorySpend`). Transfers and investment cash-flows are
  excluded from the savings calculation. Covered by 17 unit tests.
- Transaction CRUD: `app/dashboard/transactions/{page,new/page,[id]/page}.tsx`
  + `actions.ts`. `TransactionForm` (`components/finance/transaction-form.tsx`)
  uses `useActionState`, kind tabs (`INCOME`/`EXPENSE`/`TRANSFER`),
  conditional account fields, category filtering by kind, and a sticky
  `personTag` selector backed by the httpOnly `fintracker.lastPersonTag`
  cookie. List view supports month, kind, and payer filters.
- Snapshot entry: `app/dashboard/snapshots/page.tsx` + `actions.ts` +
  `components/finance/snapshot-grid.tsx`. One editable row per active
  account, pre-filled with the most recent snapshot ≤ month-end; empty
  rows are skipped server-side; a single batch audit event records
  saved/skipped counts.
- Budgets: `app/dashboard/budgets/page.tsx` + `actions.ts` +
  `components/finance/budget-row-form.tsx`. Inline add/edit/delete; per
  `(category, personTag)` progress bars vs. live spend; the household
  savings-goal rate is edited from the same surface and persists to
  `Household.savingsGoalRate`.
- Audit viewer: `app/dashboard/audit/page.tsx` shows the last 200
  `audit_events` for the household with `type` filter chips.
- Dashboard overview rewritten: real KPIs (income / expense / savings +
  savings rate vs goal), embedded collapsible `QuickEntryCard` at the
  top. Net-worth chart stays as a labelled Phase-6 placeholder.
- Refactor: `CURRENT_HOUSEHOLD_ID` promoted to `lib/auth/household.ts`
  and adopted in 3 import-related files.

**Resolved open questions:**

- Single-row transfers (schema enforces it via `fromAccountId` +
  `toAccountId`); paired-row design was rejected — net-worth math in
  Phase 6 will sum snapshots, not transfers.
- `personTag` defaults via cookie ("last used wins"); UI choices are
  Junjie / Jinyou / Household. Free-form selector since AUTH_BYPASS
  cannot distinguish users.

**Carry-forward to later phases:**

- Recurring transaction templates: explicitly out of scope; revisit
  before Phase 6 if needed.
- Jin You's sign-in identity (guest tenant vs same): still open;
  carried forward to Phase 8b.
- Net-worth chart wiring: Phase 6.

### Phase 6: Dashboards and analysis ✓ DONE

Sub-todos (tracked in SQL: `p6-*`):

- `p6-aggregates` ✓ — `lib/finance/net-worth.ts`, `cash-flow.ts`,
  `category-breakdown.ts` + 24 new unit tests (72 total green).
- `p6-charts` ✓ — pure-SVG components in `components/charts/`:
  `StackedAreaChart`, `BarsLineChart`, `DonutChart`, `LineChart` plus
  shared `palette.ts` (no chart-lib dependency added).
- `p6-net-worth-chart` ✓ — month-end snapshots stacked by `AccountKind`
  on `/dashboard/analysis` (full history) and `/dashboard` (last 12).
- `p6-cash-flow-chart` ✓ — rolling 12-month income/expense bars with
  savings-rate line and dashed household-goal reference on
  `/dashboard/analysis`.
- `p6-category-breakdown` ✓ — donut + bilingual legend with payer
  toggle (All / Junjie / Jinyou / Household / Unassigned).
- `p6-account-detail` ✓ — `/dashboard/accounts` index + `/[id]`
  drilldown with snapshot trend, recent transactions, and variance
  hints flagging snapshot-vs-transaction residuals > 1 %.
- `p6-export` ✓ — `/api/export/transactions.csv` and
  `/api/export/snapshots.csv` (RFC 4180, native currency, full
  history). PDF export deferred (see carry-forward).
- `p6-nav` ✓ — sidebar gains Analysis + Accounts entries.

Filters by person, account, category, and period are all URL search
params so the surfaces remain deep-linkable without client JS.

Carry-forward to Phase 8b:

- Quarterly PDF export — CSV + browser print-to-PDF cover the gap; a
  dedicated PDF pipeline would pull in `puppeteer`/`pdfkit` and is held
  back until the dataset shape settles.

### Phase 7: Azure AI insights

Sub-todos (tracked in SQL: `p7-*`):

- ✅ `p7-foundry-client` — `lib/ai/foundry.ts` wraps Microsoft Foundry / Azure OpenAI chat-completions over plain `fetch` (no SDK). Env-driven (`FOUNDRY_ENDPOINT`, `FOUNDRY_DEPLOYMENT`, `FOUNDRY_API_KEY`, optional `FOUNDRY_API_VERSION`, `FOUNDRY_TIMEOUT_MS`). When any of those are unset the client returns a deterministic mock response derived from the input metrics so dev + tests + the deployed site stay green without burning model quota. `/api/health/foundry` reports mode/configured/deployment/promptVersion.
- ✅ `p7-monthly-summary` — `lib/ai/{metrics,prompts,validate,insights}.ts` build aggregate-only snapshots (current vs previous month totals + deltas, savings rate vs goal, top expense categories, person split, net-worth trajectory), call the client behind a JSON-object response contract validated with Zod, then persist to `InsightRun` + `Insight` (status state machine, `payload` JSON for the structured response, `body` for the Markdown render). `/dashboard/insights` lists newest-first with a Generate CTA + thumbs feedback; latest insight surfaces on `/dashboard`. Every generation + feedback is audited as `insight`. **Aggregates only — no raw txn rows, payees, or notes ever leave the database.**
- ✅ `p7-anomaly-flags` — `lib/ai/anomalies.ts` builds a rolling 6-month baseline per `(categoryId, kind)` (sample mean + n-1 stddev, `MIN_SAMPLE_SIZE = 5`), then flags current-month txns that clear **both** `|Δ| ≥ 2σ` and `|Δ| ≥ ¥50` so we don't over-fire on tiny categories. Top 10 by |z-score| feed the prompt (rest counted as `suppressedByCap`). `lib/ai/foundry.ts` exposes `FoundryClient.detectAnomalies()` + a deterministic `buildMockAnomalyResponse` (severity derived from |z|: ≥3 high, ≥2.5 medium, else low). `lib/ai/insights.ts:generateAnomalyInsights()` orchestrates fetch → detect → call → validate → persist (`Insight.kind = ANOMALY`, payload stores the serialised report so the page can re-render txn-level facts under each explanation). Hallucinated refs are filtered before persistence. `/dashboard/insights` gains a `<DetectAnomaliesButton>` next to Generate; ANOMALY insights render in their own card with severity badges per flag. **Same privacy rule as monthly summary — no payees, notes, or descriptions ever reach the model.** Prompt version: `anomaly-flags-v1`.
- ⏸ `p7-chat-ask` — conversational sidebar with RAG over Transaction + AccountSnapshot. Carry-forward; needs a retrieval store + chat thread schema.

Cross-cutting: aggregate metric generators (`lib/ai/metrics.ts`), structured insight validation (`lib/ai/validate.ts`), prompt version tracking (`PROMPT_VERSION = "monthly-summary-v1"` stored on every InsightRun), user feedback capture (`feedback`, `feedbackNote` on `Insight`).

### Phase 8: Deployment and hardening

Split into **8a (go live)** and **8b (harden)** to get a real URL early.

#### 8a — Go live (done)

- ✅ `p8a-github-push` — repo live at https://github.com/MuyangAmigo/FinTracker (private). All 11 commits authored as `Junjie Li <11220663+MuyangAmigo@users.noreply.github.com>` so they link to the MuyangAmigo profile. `.env.local` confirmed gitignored.
- ✅ `p8a-app-service` — provisioned in subscription **Visual Studio Enterprise Subscription (a0adf30d-bf1c-4bff-9a92-b6d937d0154f)** under tenant `modsdevx.onmicrosoft.com`:
  - RG: `fintracker-rg` (southeastasia)
  - Plan: `fintracker-plan` (Linux, B1)
  - Web App: `fintracker-jl` → https://fintracker-jl.azurewebsites.net
  - Runtime: `NODE:22-lts` (Node 20 isn't offered on Linux App Service anymore)
  - Startup command: `node server.js` (set via `az webapp config set --startup-file`; runs the Next.js standalone server directly and bypasses Oryx auto-detection)
  - Health check: `/api/health`, always-on, https-only
  - SCM basic auth re-enabled (was blocked by tenant policy → flipped via `az resource update`)
  - App settings configured: `DATABASE_URL`, `AUTH_BYPASS=true`, `BASIC_AUTH_USER=household`, `BASIC_AUTH_PASSWORD=ZZl7kMsDKiFX2IWA`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET=UeXyErFWnQn6U3jQ/naMTandYBFJ88jPUXjbvIS/Qks=`, `HOUSEHOLD_NAME`, `NODE_ENV=production`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, `ENABLE_ORYX_BUILD=false`, `HOSTNAME=0.0.0.0`
  - Publish profile uploaded to GitHub repo secret `AZUREAPPSERVICE_PUBLISHPROFILE`
- ✅ `p8a-deploy` — live at https://fintracker-jl.azurewebsites.net. Two failures preceded the working deploy:
  1. **First deploy** shipped pnpm's symlinked `node_modules`. Kudu repacked it into a 884 MB `node_modules.tar.gz`; Oryx's runtime wrapper extracted that to `/node_modules`, but pnpm's `.pnpm/` layout doesn't survive tar+extract: `next` ended up at `/node_modules/next/` while its transitive deps (e.g. `@swc/helpers`) stayed buried in `.pnpm/`, so the container crashed with `Cannot find module '@swc/helpers/_/_interop_require_default'`.
  2. **Second deploy** still failed identically because Kudu left an `oryx-manifest.toml` + `node_modules.tar.gz` from the first deploy in wwwroot (OneDeploy `--type zip` doesn't purge by default), which kept re-triggering the broken startup wrapper.
  3. **Fix that worked**: (a) install pnpm with `--config.node-linker=hoisted` so the standalone bundle ships a flat, npm-style `node_modules` that Kudu can repack without losing transitive resolution; (b) set `ENABLE_ORYX_BUILD=false` to stop Oryx from rebuilding at runtime; (c) set the startup command to `node server.js` on the App Service so Oryx skips auto-detection; (d) pass `clean: true` to `azure/webapps-deploy@v3` so each deploy wipes wwwroot first. Encoded in `.github/workflows/deploy.yml` so future deploys stay clean.
- ⏸ `p8a-entra-app` — deferred; Basic Auth bypass is in place so two humans can use the site.
- ✅ `p8a-smoke` — `/api/health` → `{"status":"ok","db":"ok"}`; `/` with `household:ZZl7kMsDKiFX2IWA` returns the full HTML page (27 KB).

**Local preview is fully working.** `pnpm dev` from the repo root, then http://localhost:3000 with `household:ZZl7kMsDKiFX2IWA`. `.env.local` has the bypass + basic auth env vars added.

#### 8b — Harden
Sub-todos (tracked in SQL: `p8b-*`):

- `p8b-blob-attachments` — Storage Account + managed identity + signed-URL upload endpoint for receipts.
- `p8b-keyvault` — move secrets to Key Vault, switch App Service to Key Vault references.
- `p8b-monitoring` — App Insights via `@azure/monitor-opentelemetry`, dashboards, 5xx + Prisma-timeout alerts.
- `p8b-custom-domain` — bind a domain (or stay on `.azurewebsites.net`); auto-managed TLS cert.

Cross-cutting: IaC (Bicep) for everything in 8a/8b once shape is settled; backup/restore + cost monitoring; full security review.

## Testing and validation plan

- Unit tests for money parsing, CSV parsing, label normalization, total validation, and authorization helpers.
- Integration tests for import staging, import commit, transaction CRUD, account snapshots, budgets, and insight generation.
- End-to-end tests for sign-in, household dashboard, manual entry, import review, and export.
- Data migration reconciliation against spreadsheet totals.
- Security checks for unauthenticated access, cross-household access, CSRF-sensitive mutations, and audit logging.
- Deployment smoke tests against Azure development environment.

## Decisions and assumptions to confirm

- Authentication: assume Entra-backed auth with MFA/passkey support and no local password database.
- Hosting: assume Azure App Service or Container Apps rather than a purely static deployment because the app needs secure server-side imports, database access, and AI orchestration.
- Database: assume Azure PostgreSQL rather than Azure SQL because PostgreSQL works well with relational finance data, JSON metadata, and app-level/RLS authorization patterns.
- Data model: assume transactions, transfers, investments, and account snapshots should be modeled separately.
- AI: assume Azure model calls should use aggregate financial metrics by default for privacy and cost control.
- Language: assume the product should preserve Chinese spreadsheet labels and optionally add English display aliases.
- Currency: assume current data is primarily CNY, but the schema should support multiple currencies.

## Open product questions

- Should household members see all records by default, or should personal/private records be supported?
- Do you want receipt/attachment upload in the first version?
- Should investment tracking be simple monthly valuation, or detailed lot-level portfolio tracking?
- Should bank/card transactions be entered manually only, or should future bank import/Open Banking integration be planned?
- Do you prefer a mobile-first web app/PWA experience or a desktop dashboard first?
