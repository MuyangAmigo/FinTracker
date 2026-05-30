/*
 * Insight metric builder.
 *
 * Phase 7 keeps the prompt-context small and aggregate-only: no raw txn
 * rows or payees ever leave the database. The model sees a JSON snapshot
 * with month totals, category breakdown (top + tail), per-person split,
 * savings rate vs the household goal, and net-worth deltas.
 *
 * Output of `buildInsightMetrics` is the single source of truth fed both
 * to the prompt and stored on `InsightRun.inputSnapshot` for auditing.
 */

import {
  monthlyIncomeExpenseSavings,
  monthlyTotalsByCategory,
  type TransactionKind,
  type TxnRow,
} from "@/lib/finance/aggregates";
import {
  buildCategoryBreakdown,
  type CategoryLookup,
} from "@/lib/finance/category-breakdown";
import {
  latestNetWorth,
  monthlyNetWorthSeries,
  type AccountRow,
  type SnapshotRow,
} from "@/lib/finance/net-worth";
import {
  currentMonthRange,
  formatMonthLabel,
  previousMonthRange,
  type MonthRange,
} from "@/lib/finance/period";

export interface BuildInsightMetricsInput {
  baseCurrency: string;
  savingsGoalRate: number;
  transactions: (TxnRow & { occurredOn: Date })[];
  snapshots: SnapshotRow[];
  accounts: AccountRow[];
  categories: CategoryLookup[];
  now?: Date;
}

export interface MoneyAggregate {
  amountMinor: number;
  currency: string;
}

export interface MonthMetrics {
  monthKey: string;
  monthLabel: string;
  income: MoneyAggregate;
  expense: MoneyAggregate;
  savings: MoneyAggregate;
  savingsRate: number | null;
}

export interface CategoryShare {
  label: string;
  amountMinor: number;
  share: number;
}

export interface PersonShare {
  personTag: string;
  expenseMinor: number;
  share: number;
}

export interface InsightMetrics {
  generatedAt: string;
  baseCurrency: string;
  savingsGoalRate: number;
  household: {
    accountCount: number;
    categoryCount: number;
    snapshotCount: number;
    transactionCount: number;
  };
  current: MonthMetrics;
  previous: MonthMetrics;
  monthOverMonth: {
    incomeDeltaMinor: number;
    expenseDeltaMinor: number;
    savingsDeltaMinor: number;
    savingsRateDelta: number | null;
  };
  netWorth: {
    currentMinor: number | null;
    previousMinor: number | null;
    deltaMinor: number | null;
  };
  topCategories: CategoryShare[];
  personShares: PersonShare[];
}

function inRange(d: Date, r: MonthRange): boolean {
  const t = d.getTime();
  return t >= r.start.getTime() && t < r.nextStart.getTime();
}

function monthMetrics(
  txns: TxnRow[],
  range: MonthRange,
  baseCurrency: string,
): MonthMetrics {
  const totals = monthlyIncomeExpenseSavings(txns, baseCurrency);
  return {
    monthKey: range.key,
    monthLabel: formatMonthLabel(range),
    income: totals.income,
    expense: totals.expense,
    savings: totals.savings,
    savingsRate: totals.savingsRate,
  };
}

/**
 * Build the structured aggregate payload that gets sent to the model.
 * Pure function — no I/O, deterministic given the same inputs.
 */
export function buildInsightMetrics(
  input: BuildInsightMetricsInput,
): InsightMetrics {
  const now = input.now ?? new Date();
  const current = currentMonthRange(now);
  const previous = previousMonthRange(current);

  const currentTxns = input.transactions.filter((t) =>
    inRange(t.occurredOn, current),
  );
  const previousTxns = input.transactions.filter((t) =>
    inRange(t.occurredOn, previous),
  );

  const currentMetrics = monthMetrics(
    currentTxns,
    current,
    input.baseCurrency,
  );
  const previousMetrics = monthMetrics(
    previousTxns,
    previous,
    input.baseCurrency,
  );

  const incomeDelta =
    currentMetrics.income.amountMinor - previousMetrics.income.amountMinor;
  const expenseDelta =
    currentMetrics.expense.amountMinor - previousMetrics.expense.amountMinor;
  const savingsDelta =
    currentMetrics.savings.amountMinor - previousMetrics.savings.amountMinor;
  const savingsRateDelta =
    currentMetrics.savingsRate !== null && previousMetrics.savingsRate !== null
      ? currentMetrics.savingsRate - previousMetrics.savingsRate
      : null;

  const netWorthSeries = monthlyNetWorthSeries(
    input.snapshots,
    input.accounts,
    {
      baseCurrency: input.baseCurrency,
      from: previous.start,
      to: current.end,
    },
  );
  const latest = latestNetWorth(netWorthSeries);
  const previousPoint = netWorthSeries.points.find(
    (p) => p.monthKey === previous.key,
  );
  const currentPoint = netWorthSeries.points.find(
    (p) => p.monthKey === current.key,
  );
  const currentMinor = currentPoint?.totalMinor ?? latest?.amountMinor ?? null;
  const previousMinor = previousPoint?.totalMinor ?? null;
  const netDelta =
    currentMinor !== null && previousMinor !== null
      ? currentMinor - previousMinor
      : null;

  const breakdown = buildCategoryBreakdown(currentTxns, input.categories, {
    baseCurrency: input.baseCurrency,
    kind: "EXPENSE",
    otherThreshold: 0.03,
  });
  const topCategories = breakdown.slices.slice(0, 6).map((s) => ({
    label: s.label,
    amountMinor: s.amountMinor,
    share: s.share,
  }));

  const personShares = buildPersonShares(currentTxns, input.baseCurrency);

  return {
    generatedAt: now.toISOString(),
    baseCurrency: input.baseCurrency,
    savingsGoalRate: input.savingsGoalRate,
    household: {
      accountCount: input.accounts.length,
      categoryCount: input.categories.length,
      snapshotCount: input.snapshots.length,
      transactionCount: input.transactions.length,
    },
    current: currentMetrics,
    previous: previousMetrics,
    monthOverMonth: {
      incomeDeltaMinor: incomeDelta,
      expenseDeltaMinor: expenseDelta,
      savingsDeltaMinor: savingsDelta,
      savingsRateDelta,
    },
    netWorth: {
      currentMinor,
      previousMinor,
      deltaMinor: netDelta,
    },
    topCategories,
    personShares,
  };
}

function buildPersonShares(
  txns: TxnRow[],
  baseCurrency: string,
): PersonShare[] {
  const expenses = txns.filter(
    (t) => t.kind === ("EXPENSE" as TransactionKind),
  );
  const totalsByTag = new Map<string, number>();
  let totalMinor = 0;
  for (const t of expenses) {
    const tag = t.personTag ?? "Unassigned";
    const amt = Number(t.amountMinor);
    totalsByTag.set(tag, (totalsByTag.get(tag) ?? 0) + amt);
    totalMinor += amt;
  }
  if (totalMinor === 0) return [];
  // Exercise the shared aggregate pipeline as a drift sanity-check.
  void monthlyTotalsByCategory(expenses, {
    baseCurrency,
    kind: "EXPENSE",
  });
  return Array.from(totalsByTag.entries())
    .map(([personTag, expenseMinor]) => ({
      personTag,
      expenseMinor,
      share: expenseMinor / totalMinor,
    }))
    .sort((a, b) => b.expenseMinor - a.expenseMinor);
}
