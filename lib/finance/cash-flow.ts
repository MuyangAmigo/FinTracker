/*
 * Cash-flow trend aggregation for Phase-6 dashboards.
 *
 * Inputs: a flat list of transactions with `occurredOn` dates. We bucket
 * them by calendar month (UTC) and roll up income / expense / savings /
 * savings-rate per bucket using the same conventions as
 * `monthlyIncomeExpenseSavings` (transfers and investment cash-flows are
 * excluded from the savings calc).
 */

import {
  monthlyIncomeExpenseSavings,
  type TxnRow,
} from "@/lib/finance/aggregates";
import { monthRange, type MonthRange } from "@/lib/finance/period";
import type { Money } from "@/lib/money";

import { monthsBetween } from "@/lib/finance/net-worth";

export interface CashFlowTxn extends TxnRow {
  occurredOn: Date;
}

export interface CashFlowPoint {
  monthKey: string;
  income: Money;
  expense: Money;
  savings: Money;
  /** income == 0 → null. */
  savingsRate: number | null;
}

export interface CashFlowSeries {
  currency: string;
  /** Inclusive chronological list of monthly points. */
  points: CashFlowPoint[];
}

export interface CashFlowOptions {
  baseCurrency: string;
  /** First month to include. Default: oldest transaction. */
  from?: Date;
  /** Last month to include. Default: newest transaction. */
  to?: Date;
}

/**
 * Build a per-month income/expense/savings series across the window. Empty
 * months produce zero rows so the chart can render a continuous axis.
 */
export function monthlyCashFlowSeries(
  txns: CashFlowTxn[],
  opts: CashFlowOptions,
): CashFlowSeries {
  if (txns.length === 0) {
    return { currency: opts.baseCurrency, points: [] };
  }

  let earliest = txns[0].occurredOn;
  let latest = txns[0].occurredOn;
  for (const t of txns) {
    if (t.occurredOn.getTime() < earliest.getTime()) earliest = t.occurredOn;
    if (t.occurredOn.getTime() > latest.getTime()) latest = t.occurredOn;
  }
  const from = opts.from ?? earliest;
  const to = opts.to ?? latest;
  const months: MonthRange[] = monthsBetween(from, to);

  // Bucket transactions by month key for O(N) grouping.
  const buckets = new Map<string, CashFlowTxn[]>();
  for (const t of txns) {
    const key = monthRange(
      t.occurredOn.getUTCFullYear(),
      t.occurredOn.getUTCMonth(),
    ).key;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(t);
    else buckets.set(key, [t]);
  }

  const points: CashFlowPoint[] = months.map((m) => {
    const bucket = buckets.get(m.key) ?? [];
    const totals = monthlyIncomeExpenseSavings(bucket, opts.baseCurrency);
    return {
      monthKey: m.key,
      income: totals.income,
      expense: totals.expense,
      savings: totals.savings,
      savingsRate: totals.savingsRate,
    };
  });

  return { currency: opts.baseCurrency, points };
}

/**
 * Helper for the rolling-12-month window used by the analysis dashboard.
 */
export function rollingTwelveMonthRange(
  now: Date = new Date(),
): { from: Date; to: Date } {
  const end = monthRange(now.getUTCFullYear(), now.getUTCMonth());
  const start = monthRange(
    end.start.getUTCFullYear(),
    end.start.getUTCMonth() - 11,
  );
  return { from: start.start, to: end.end };
}
