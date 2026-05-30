# FinTracker

A secure, household finance tracking and analysis web app for Junjie and Jin
You. Replaces a multi-year Excel workflow with structured records, a dashboard,
and Azure-AI-assisted insights.

> Source-of-truth documents
>
> - [`plan.md`](./plan.md) — full implementation plan and product spec.
> - [`DESIGN.md`](./DESIGN.md) — visual design language (Stripi-inspired).
> - [`assets/csv-record-tracker/`](./assets/csv-record-tracker) — historical
>   spreadsheet exports. Read-only.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** with design tokens generated from `DESIGN.md`
- **Inter** as the open-source substitute for Sohne
- **pnpm** package manager
- Planned: **Prisma + PostgreSQL**, **Auth.js v5 + Microsoft Entra**,
  **Azure Container Apps** for hosting, **Azure AI Foundry** for insights.

## Project layout

```
.
├── app/                      # Next.js App Router routes
│   ├── layout.tsx            # Root layout, fonts, theming
│   ├── page.tsx              # Marketing landing page
│   ├── dashboard/            # Authenticated dashboard (placeholder in Phase 1)
│   └── sign-in/              # Auth landing (placeholder in Phase 1)
├── components/
│   ├── ui/                   # Design-system primitives (Button, Card, Money…)
│   └── marketing/            # Marketing-only components (GradientMesh, Nav)
├── lib/                      # Shared helpers (cn, money formatting, etc.)
├── assets/                   # Historical CSV finance records (legacy data)
├── DESIGN.md                 # Design system source of truth
└── plan.md                   # Full implementation plan
```

## Getting started

```sh
pnpm install
cp .env.example .env.local        # fill in secrets as you reach each phase
pnpm dev                          # http://localhost:3000
```

Other useful scripts:

```sh
pnpm lint                         # ESLint (Next.js core-web-vitals + TS)
pnpm format                       # Prettier write
pnpm format:check                 # Prettier check
pnpm build                        # Production build
```

## Implementation phases

Tracked in `plan.md`. Status:

- [x] **Phase 1** — Product and architecture baseline (this scaffold).
- [x] **Phase 2** — Microsoft Entra auth + household membership.
- [x] **Phase 3** — Prisma + PostgreSQL finance schema.
- [x] **Phase 4** — Legacy CSV import.
- [x] **Phase 5** — Manual tracking workflows.
- [x] **Phase 6** — Dashboards and analysis.
- [x] **Phase 7** — Azure AI insights (monthly summaries + anomaly flags;
  chat carried forward).
- [x] **Phase 8a** — Azure deployment (live at
  `https://fintracker-jl.azurewebsites.net`).
- [ ] Phase 8b — Hardening (real Entra auth, structured audit log,
  quarterly PDF export, Foundry managed identity + Key Vault).

## Design tokens

Tokens from `DESIGN.md` are exposed in `app/globals.css` under `@theme`:

- **Colors:** `bg-primary`, `text-ink`, `bg-canvas`, `bg-canvas-cream`,
  `border-hairline`, `bg-brand-dark-900`, etc.
- **Radius:** `rounded-xs|sm|md|lg|xl|pill`.
- **Typography roles** (utility classes):
  `font-display-xxl|xl|lg|md`, `font-heading-lg|md|sm`,
  `font-body-lg|md|tabular`, `font-button-md|sm`,
  `font-caption`, `font-micro`, `font-micro-cap`.
- **Money formatting:** wrap currency values in `<Money>` from
  `components/ui/money.tsx`. Always use tabular figures for monetary values.
- **Marketing hero:** wrap in `<GradientMesh>` (CSS-mesh approximation; swap
  for SVG mesh later for production fidelity).

## Decisions and assumptions (Phase 1)

| Decision         | Choice                                | Reason                                                      |
| ---------------- | ------------------------------------- | ----------------------------------------------------------- |
| Framework        | Next.js 16 + App Router               | Per `plan.md`; secure SSR + server actions for finance data |
| Package manager  | pnpm                                  | Already installed; fast, deterministic                      |
| Styling          | Tailwind v4 + token classes           | Theme tokens come straight from `DESIGN.md`                 |
| Font             | Inter (Sohne substitute)              | Per `DESIGN.md` recommendation — Sohne is proprietary       |
| Project layout   | Single app at repo root               | One product, one app — no monorepo complexity               |
| Local DB (later) | Postgres via Docker / Postgres.app    | Parity with Azure PostgreSQL Flexible Server                |
| Hosting (later)  | Azure Container Apps                  | Best fit for SSR + auth + AI orchestration                  |
| ORM (later)      | Prisma                                | Ecosystem, migrations, type-safety                          |

These are the working defaults; override before later phases if you prefer
different tools.
