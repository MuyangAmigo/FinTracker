import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PillTag } from "@/components/ui/pill-tag";
import { QuickEntryCard } from "@/components/finance/quick-entry-card";
import {
  StackedAreaChart,
  type AreaSeries,
} from "@/components/charts/stacked-area-chart";
import { KIND_COLOUR, KIND_LABEL } from "@/components/charts/palette";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  monthlyIncomeExpenseSavings,
  type TxnRow,
} from "@/lib/finance/aggregates";
import {
  currentMonthRange,
  formatMonthLabel,
} from "@/lib/finance/period";
import {
  monthlyNetWorthSeries,
  type AccountKind,
  type AccountRow,
  type SnapshotRow,
} from "@/lib/finance/net-worth";

import {
  createTransactionAction,
  readLastPersonTag,
} from "./transactions/actions";
import {
  loadAccountOptions,
  loadCategoryOptions,
  loadHouseholdCurrency,
} from "@/lib/finance/reference-data";

export const dynamic = "force-dynamic";

/*
 * Dashboard overview, Phase-5 edition.
 *
 * The sidebar lives in app/dashboard/layout.tsx now; this file owns only the
 * <main> column. KPIs are wired to real transactions for the current calendar
 * month via lib/finance/aggregates.ts. The net-worth chart remains a labelled
 * placeholder until Phase 6 lands snapshot-driven aggregation.
 */

export default async function DashboardHome() {
  const session = await requireSession();
  const user = session.user;
  const greetingName = user.name?.split(" ")[0] ?? user.email ?? "there";

  const range = currentMonthRange();
  const monthLabel = formatMonthLabel(range);

  const [
    household,
    txns,
    accountList,
    snapshots,
    accounts,
    categories,
    lastPersonTag,
    currency,
  ] = await Promise.all([
    prisma.household.findUnique({
      where: { id: CURRENT_HOUSEHOLD_ID },
      select: { baseCurrency: true, savingsGoalRate: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: CURRENT_HOUSEHOLD_ID,
        occurredOn: { gte: range.start, lt: range.nextStart },
      },
      select: {
        kind: true,
        amountMinor: true,
        currency: true,
        categoryId: true,
        personTag: true,
      },
    }),
    prisma.account.findMany({
      where: { householdId: CURRENT_HOUSEHOLD_ID, archivedAt: null },
      select: { id: true, kind: true },
    }),
    prisma.accountSnapshot.findMany({
      where: { householdId: CURRENT_HOUSEHOLD_ID },
      select: {
        accountId: true,
        asOf: true,
        balanceMinor: true,
        currency: true,
      },
    }),
    loadAccountOptions(),
    loadCategoryOptions(),
    readLastPersonTag(),
    loadHouseholdCurrency(),
  ]);

  const baseCurrency = household?.baseCurrency ?? "CNY";
  const totals = monthlyIncomeExpenseSavings(txns as TxnRow[], baseCurrency);
  const goalFraction = household?.savingsGoalRate
    ? Number(household.savingsGoalRate)
    : 0.6;
  const actualRate = totals.savingsRate;
  const onTrack =
    actualRate !== null ? actualRate >= goalFraction : null;

  const accountRows: AccountRow[] = accountList.map((a) => ({
    id: a.id,
    kind: a.kind as AccountKind,
  }));
  const snapshotRows: SnapshotRow[] = snapshots.map((s) => ({
    accountId: s.accountId,
    asOf: s.asOf,
    balanceMinor: s.balanceMinor,
    currency: s.currency,
  }));
  const fullNetWorth = monthlyNetWorthSeries(snapshotRows, accountRows, {
    baseCurrency,
  });
  // Trim to the most recent 12 months so the overview card stays compact.
  const netWorth = {
    ...fullNetWorth,
    points: fullNetWorth.points.slice(-12),
  };
  const netWorthSeries: AreaSeries[] = netWorth.presentKinds.map((k) => ({
    key: k,
    label: KIND_LABEL[k],
    colour: KIND_COLOUR[k],
    values: netWorth.points.map((p) => p.byKindMinor[k]),
  }));

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <PillTag>Household · {monthLabel}</PillTag>
            <h1 className="font-display-lg mt-3 text-on-primary">
              Welcome back, {greetingName}.
            </h1>
            <p className="font-body-md mt-1 text-on-primary/70">
              {txns.length === 0
                ? "Nothing recorded yet for this month — capture your first transaction."
                : `${txns.length} transaction${txns.length === 1 ? "" : "s"} recorded so far this month.`}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard/transactions/new"
              className="rounded-pill bg-brand-dark-900 px-4 py-2 font-button-md text-on-primary hover:bg-ink-secondary"
            >
              Add transaction
            </Link>
            <Link
              href="/dashboard/snapshots"
              className="rounded-pill border border-white/20 bg-canvas/10 px-4 py-2 font-button-md text-on-primary hover:bg-white/10"
            >
              Log balances
            </Link>
          </div>
        </header>

        <section className="mb-8">
          <QuickEntryCard
            action={createTransactionAction}
            accounts={accounts}
            categories={categories}
            defaultPersonTag={lastPersonTag}
            defaultCurrency={currency}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Income" value={totals.income} />
          <KpiCard label="Expenses" value={totals.expense} tone="negative" />
          <KpiCard
            label="Savings"
            value={totals.savings}
            accent
            footnote={
              actualRate !== null
                ? `${(actualRate * 100).toFixed(1)}% · goal ${(goalFraction * 100).toFixed(0)}%`
                : "No income recorded yet"
            }
            footnoteTone={
              onTrack === null
                ? "neutral"
                : onTrack
                  ? "positive"
                  : "negative"
            }
          />
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <Card
            variant="dashboardMockup"
            padding="md"
            className="bg-brand-dark-900/60 text-on-primary lg:col-span-2"
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="font-micro-cap text-on-primary/60">
                Net-worth · last 12 months
              </p>
              <Link
                href="/dashboard/analysis"
                className="font-micro-cap text-primary-soft hover:underline"
              >
                Full analysis →
              </Link>
            </div>
            {netWorth.points.length === 0 ? (
              <p className="font-body-md py-8 text-center text-on-primary/60">
                No snapshots logged yet.{" "}
                <Link
                  href="/dashboard/snapshots"
                  className="text-primary-soft hover:underline"
                >
                  Record month-end balances →
                </Link>
              </p>
            ) : (
              <>
                <StackedAreaChart
                  ariaLabel="Net-worth trend stacked by account kind"
                  xLabels={netWorth.points.map((p) => p.monthKey.slice(2))}
                  series={netWorthSeries}
                  height={200}
                />
                <ul className="font-micro mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-on-primary/70">
                  {netWorth.presentKinds.map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: KIND_COLOUR[k] }}
                      />
                      {KIND_LABEL[k]}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card
            variant="dashboardMockup"
            padding="md"
            className="bg-brand-dark-900/60 text-on-primary"
          >
            <p className="font-micro-cap mb-3 text-on-primary/60">
              Quick links
            </p>
            <ul className="font-body-md space-y-2">
              <li>
                <Link
                  href="/dashboard/transactions"
                  className="text-primary-soft hover:underline"
                >
                  View all transactions →
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/budgets"
                  className="text-primary-soft hover:underline"
                >
                  Manage budgets →
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/analysis"
                  className="text-primary-soft hover:underline"
                >
                  Trends and breakdowns →
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/accounts"
                  className="text-primary-soft hover:underline"
                >
                  Per-account drilldown →
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/snapshots"
                  className="text-primary-soft hover:underline"
                >
                  Record month-end balances →
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/audit"
                  className="text-primary-soft hover:underline"
                >
                  Audit activity →
                </Link>
              </li>
            </ul>
          </Card>
        </section>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  accent,
  tone,
  footnote,
  footnoteTone,
}: {
  label: string;
  value: { amountMinor: number; currency: string };
  accent?: boolean;
  tone?: "positive" | "negative" | "neutral";
  footnote?: string;
  footnoteTone?: "positive" | "negative" | "neutral";
}) {
  return (
    <Card
      variant="dashboardMockup"
      padding="md"
      className={
        accent
          ? "bg-primary text-on-primary"
          : "bg-brand-dark-900/60 text-on-primary"
      }
    >
      <p className="font-micro-cap text-on-primary/70">{label}</p>
      <Money
        className="font-display-md mt-2 text-on-primary"
        value={value}
        tone={tone}
      />
      {footnote ? (
        <p
          className={
            footnoteTone === "negative"
              ? "font-body-md mt-2 text-ruby"
              : footnoteTone === "positive"
                ? "font-body-md mt-2 text-primary-soft"
                : "font-body-md mt-2 text-on-primary/70"
          }
        >
          {footnote}
        </p>
      ) : null}
    </Card>
  );
}
