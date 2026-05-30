import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PillTag } from "@/components/ui/pill-tag";
import {
  BarsLineChart,
  type BarPoint,
} from "@/components/charts/bars-line-chart";
import {
  DonutChart,
  type DonutSlice,
} from "@/components/charts/donut-chart";
import {
  StackedAreaChart,
  type AreaSeries,
} from "@/components/charts/stacked-area-chart";
import {
  CATEGORY_PALETTE,
  KIND_COLOUR,
  KIND_LABEL,
} from "@/components/charts/palette";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  monthlyCashFlowSeries,
  rollingTwelveMonthRange,
  type CashFlowTxn,
} from "@/lib/finance/cash-flow";
import {
  buildCategoryBreakdown,
  type CategoryLookup,
} from "@/lib/finance/category-breakdown";
import {
  latestNetWorth,
  monthlyNetWorthSeries,
  type AccountKind,
  type AccountRow,
  type SnapshotRow,
} from "@/lib/finance/net-worth";
import {
  currentMonthRange,
  formatMonthLabel,
  monthRangeFromKey,
} from "@/lib/finance/period";
import { formatMoney } from "@/lib/money";
import type { TxnRow } from "@/lib/finance/aggregates";

export const dynamic = "force-dynamic";

interface SearchParams {
  month?: string;
  personTag?: string;
}

/*
 * Phase 6 — Analysis dashboard.
 *
 * Three sections:
 *   - Net-worth trend (stacked area by AccountKind, full history)
 *   - 12-month cash flow (bars + savings-rate line + goal reference)
 *   - Category breakdown for the selected month (donut, person filter)
 *
 * All charts are server-rendered SVG. Filters use plain URL query params so
 * the page stays navigable without client JS.
 */
export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSession();
  const sp = await searchParams;

  const focusMonth = sp.month ? safeMonthRange(sp.month) : currentMonthRange();
  const personFilter = sp.personTag;
  const rolling = rollingTwelveMonthRange();

  const [household, accounts, snapshots, allTxns, monthTxns, categories] =
    await Promise.all([
      prisma.household.findUnique({
        where: { id: CURRENT_HOUSEHOLD_ID },
        select: { baseCurrency: true, savingsGoalRate: true },
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
      prisma.transaction.findMany({
        where: {
          householdId: CURRENT_HOUSEHOLD_ID,
          occurredOn: { gte: rolling.from, lte: rolling.to },
        },
        select: {
          kind: true,
          amountMinor: true,
          currency: true,
          categoryId: true,
          personTag: true,
          occurredOn: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          householdId: CURRENT_HOUSEHOLD_ID,
          occurredOn: { gte: focusMonth.start, lt: focusMonth.nextStart },
        },
        select: {
          kind: true,
          amountMinor: true,
          currency: true,
          categoryId: true,
          personTag: true,
        },
      }),
      prisma.category.findMany({
        where: { householdId: CURRENT_HOUSEHOLD_ID },
        select: { id: true, name: true, nameZh: true },
      }),
    ]);

  const baseCurrency = household?.baseCurrency ?? "CNY";
  const goalFraction = household?.savingsGoalRate
    ? Number(household.savingsGoalRate)
    : 0.6;

  const accountRows: AccountRow[] = accounts.map((a) => ({
    id: a.id,
    kind: a.kind as AccountKind,
  }));
  const snapshotRows: SnapshotRow[] = snapshots.map((s) => ({
    accountId: s.accountId,
    asOf: s.asOf,
    balanceMinor: s.balanceMinor,
    currency: s.currency,
  }));

  const netWorth = monthlyNetWorthSeries(snapshotRows, accountRows, {
    baseCurrency,
  });
  const latest = latestNetWorth(netWorth);

  const cashFlow = monthlyCashFlowSeries(
    allTxns.map(
      (t): CashFlowTxn => ({
        kind: t.kind as CashFlowTxn["kind"],
        amountMinor: t.amountMinor,
        currency: t.currency,
        categoryId: t.categoryId,
        personTag: t.personTag,
        occurredOn: t.occurredOn,
      }),
    ),
    { baseCurrency, from: rolling.from, to: rolling.to },
  );

  const categoryLookup: CategoryLookup[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    nameZh: c.nameZh,
  }));
  const breakdown = buildCategoryBreakdown(
    monthTxns as TxnRow[],
    categoryLookup,
    {
      baseCurrency,
      kind: "EXPENSE",
      personTag: personFilter === "__none__" ? null : personFilter,
    },
  );

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <PillTag>Analysis</PillTag>
          <h1 className="font-display-md mt-3 text-on-primary">
            Trends and breakdowns
          </h1>
          <p className="font-body-md mt-1 text-on-primary/70">
            Net-worth history, rolling cash flow vs goal, and category
            breakdown for {formatMonthLabel(focusMonth)}.
          </p>
        </header>

        {/* === Net-worth trend === */}
        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 mb-8 text-on-primary"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-micro-cap text-on-primary/60">
                Net-worth trend
              </p>
              <p className="font-body-md text-on-primary/70">
                Month-end balances per account kind, from oldest snapshot to
                latest.
              </p>
            </div>
            {latest ? (
              <div className="text-right">
                <p className="font-micro-cap text-on-primary/60">
                  Latest total
                </p>
                <Money
                  value={latest}
                  className="font-display-md text-on-primary"
                />
              </div>
            ) : null}
          </div>

          {netWorth.points.length === 0 ? (
            <p className="font-body-md py-8 text-center text-on-primary/60">
              No snapshots recorded yet.{" "}
              <Link
                href="/dashboard/snapshots"
                className="text-primary-soft hover:underline"
              >
                Log balances →
              </Link>
            </p>
          ) : (
            <>
              <StackedAreaChart
                ariaLabel="Net-worth trend stacked by account kind"
                xLabels={netWorth.points.map((p) => p.monthKey)}
                series={buildNetWorthSeries(netWorth.points, netWorth.presentKinds)}
                height={280}
              />
              <ChartLegend
                items={netWorth.presentKinds.map((k) => ({
                  colour: KIND_COLOUR[k],
                  label: KIND_LABEL[k],
                }))}
              />
            </>
          )}
        </Card>

        {/* === Cash-flow === */}
        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 mb-8 text-on-primary"
        >
          <div className="mb-4">
            <p className="font-micro-cap text-on-primary/60">
              Cash flow · rolling 12 months
            </p>
            <p className="font-body-md text-on-primary/70">
              Income and expense per month with savings rate vs the household
              goal of {Math.round(goalFraction * 100)}%.
            </p>
          </div>

          {cashFlow.points.length === 0 ? (
            <p className="font-body-md py-8 text-center text-on-primary/60">
              No transactions recorded in the last 12 months.
            </p>
          ) : (
            <>
              <BarsLineChart
                points={cashFlow.points.map(
                  (p): BarPoint => ({
                    label: p.monthKey.slice(2),
                    income: p.income.amountMinor,
                    expense: p.expense.amountMinor,
                    rate: p.savingsRate,
                  }),
                )}
                referenceRate={goalFraction}
                height={300}
              />
              <ChartLegend
                items={[
                  { colour: "#665efd", label: "Income" },
                  { colour: "#ea2261", label: "Expense" },
                  { colour: "#f5e9d4", label: "Savings rate" },
                ]}
              />
            </>
          )}
        </Card>

        {/* === Category breakdown === */}
        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 mb-8 text-on-primary"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-micro-cap text-on-primary/60">
                Expense by category · {formatMonthLabel(focusMonth)}
              </p>
              <p className="font-body-md text-on-primary/70">
                Filter by person to see how each member contributed.
              </p>
            </div>
            <PersonFilters
              current={personFilter}
              monthKey={focusMonth.key}
            />
          </div>

          {breakdown.slices.length === 0 ? (
            <p className="font-body-md py-8 text-center text-on-primary/60">
              No expense recorded for this filter.
            </p>
          ) : (
            <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
              <DonutChart
                slices={buildDonutSlices(breakdown.slices)}
                centerLabel={formatMoney({
                  amountMinor: breakdown.totalMinor,
                  currency: breakdown.currency,
                })}
                centerSubLabel="Total"
                size={240}
                className="block text-on-primary"
              />
              <ul className="space-y-2">
                {breakdown.slices.map((s, i) => (
                  <li
                    key={`${s.categoryId ?? "none"}-${i}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 shrink-0 rounded-sm"
                        style={{
                          backgroundColor:
                            CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
                        }}
                      />
                      <span className="font-body-md truncate">{s.label}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-micro-cap text-on-primary/60">
                        {(s.share * 100).toFixed(1)}%
                      </span>
                      <Money
                        value={{
                          amountMinor: s.amountMinor,
                          currency: breakdown.currency,
                        }}
                        className="text-on-primary"
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* === Export === */}
        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          <p className="font-micro-cap mb-2 text-on-primary/60">Export data</p>
          <p className="font-body-md mb-4 text-on-primary/70">
            CSV downloads cover the full household history. Use them for
            ad-hoc spreadsheet analysis or off-site backup.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/api/export/transactions.csv"
              className="rounded-pill bg-primary px-4 py-2 font-button-sm text-on-primary hover:bg-primary-deep"
            >
              Transactions CSV
            </Link>
            <Link
              href="/api/export/snapshots.csv"
              className="rounded-pill border border-white/15 px-4 py-2 font-button-sm text-on-primary hover:bg-white/5"
            >
              Snapshots CSV
            </Link>
          </div>
          <p className="font-micro mt-3 text-on-primary/50">
            Quarterly PDF export is on the Phase-8b carry-forward list.
          </p>
        </Card>
      </div>
    </main>
  );
}

function buildNetWorthSeries(
  points: { byKindMinor: Record<AccountKind, number> }[],
  presentKinds: AccountKind[],
): AreaSeries[] {
  return presentKinds.map((kind) => ({
    key: kind,
    label: KIND_LABEL[kind],
    colour: KIND_COLOUR[kind],
    values: points.map((p) => p.byKindMinor[kind]),
  }));
}

function buildDonutSlices(
  slices: { categoryId: string | null; label: string; amountMinor: number }[],
): DonutSlice[] {
  return slices.map((s, i) => ({
    key: `${s.categoryId ?? "none"}-${i}`,
    label: s.label,
    value: s.amountMinor,
    colour: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
  }));
}

function ChartLegend({
  items,
}: {
  items: { colour: string; label: string }[];
}) {
  return (
    <ul className="font-micro mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-on-primary/70">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: i.colour }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function PersonFilters({
  current,
  monthKey,
}: {
  current?: string;
  monthKey: string;
}) {
  const choices: { label: string; value?: string }[] = [
    { label: "All" },
    { label: "Junjie", value: "Junjie" },
    { label: "Jinyou", value: "Jinyou" },
    { label: "Household", value: "Household" },
    { label: "Unassigned", value: "__none__" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-micro-cap text-on-primary/60">Payer:</span>
      {choices.map((c) => {
        const active = current === c.value;
        const href = c.value
          ? `/dashboard/analysis?month=${monthKey}&personTag=${encodeURIComponent(c.value)}`
          : `/dashboard/analysis?month=${monthKey}`;
        return (
          <Link
            key={c.label}
            href={href}
            className={
              active
                ? "rounded-pill bg-primary px-3 py-1 font-button-sm text-on-primary"
                : "rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
            }
          >
            {c.label}
          </Link>
        );
      })}
    </div>
  );
}

function safeMonthRange(key: string) {
  try {
    return monthRangeFromKey(key);
  } catch {
    return currentMonthRange();
  }
}
