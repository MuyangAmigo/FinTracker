/*
 * Pure aggregate helpers for Phase-5 dashboards.
 *
 * These functions take fully-hydrated transaction objects and return totals
 * grouped by kind / category / personTag. By keeping them pure we get cheap
 * unit tests (no DB required) and the dashboard server components can pull
 * raw rows once and slice them locally instead of re-querying.
 *
 * `amountMinor` arrives as `bigint` from Prisma. Aggregates use `bigint`
 * end-to-end and only convert to `Money` (number) when returning, since
 * household monthly totals stay well within `Number.MAX_SAFE_INTEGER`.
 */

import type { Money } from "@/lib/money";

export type TransactionKind =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "INVESTMENT_CONTRIBUTION"
  | "INVESTMENT_WITHDRAWAL"
  | "ADJUSTMENT";

/** Minimal shape required by these aggregates. Matches Prisma's Transaction. */
export interface TxnRow {
  kind: TransactionKind;
  amountMinor: bigint;
  currency: string;
  categoryId: string | null;
  personTag: string | null;
}

const ZERO = BigInt(0);

function sumMinor(txns: TxnRow[]): bigint {
  return txns.reduce<bigint>((acc, t) => acc + t.amountMinor, ZERO);
}

export interface MonthlyTotals {
  income: Money;
  expense: Money;
  transferOut: Money;
  /** income − expense. Can be negative when expenses exceed income. */
  savings: Money;
  /** savings / income, or null when income is 0. */
  savingsRate: number | null;
  currency: string;
}

/**
 * Roll up a month's transactions into the headline KPI bundle.
 *
 * Transfers are ignored in the savings calculation (a transfer is neither
 * income nor expense, just rearranging existing assets). Investment
 * contributions/withdrawals are also excluded — they belong to net worth
 * via snapshots, not to monthly cash flow.
 */
export function monthlyIncomeExpenseSavings(
  txns: TxnRow[],
  baseCurrency: string,
): MonthlyTotals {
  const incomeRows = txns.filter((t) => t.kind === "INCOME");
  const expenseRows = txns.filter((t) => t.kind === "EXPENSE");
  const transferRows = txns.filter((t) => t.kind === "TRANSFER");

  const income = sumMinor(incomeRows);
  const expense = sumMinor(expenseRows);
  const transferOut = sumMinor(transferRows);
  const savings = income - expense;

  const savingsRate =
    income === ZERO ? null : Number(savings) / Number(income);

  return {
    income: { amountMinor: Number(income), currency: baseCurrency },
    expense: { amountMinor: Number(expense), currency: baseCurrency },
    transferOut: { amountMinor: Number(transferOut), currency: baseCurrency },
    savings: { amountMinor: Number(savings), currency: baseCurrency },
    savingsRate,
    currency: baseCurrency,
  };
}

export interface CategoryTotal {
  categoryId: string | null;
  total: Money;
}

/**
 * Per-category totals, optionally narrowed to a single kind / personTag.
 * Returns one row per categoryId (null bucket for uncategorised rows).
 */
export function monthlyTotalsByCategory(
  txns: TxnRow[],
  opts: {
    baseCurrency: string;
    kind?: TransactionKind;
    personTag?: string | null;
  },
): CategoryTotal[] {
  const filtered = txns.filter((t) => {
    if (opts.kind && t.kind !== opts.kind) return false;
    if (opts.personTag !== undefined && t.personTag !== opts.personTag) {
      return false;
    }
    return true;
  });

  const buckets = new Map<string | null, bigint>();
  for (const t of filtered) {
    const key = t.categoryId;
    buckets.set(key, (buckets.get(key) ?? ZERO) + t.amountMinor);
  }

  return Array.from(buckets.entries()).map(([categoryId, sum]) => ({
    categoryId,
    total: { amountMinor: Number(sum), currency: opts.baseCurrency },
  }));
}

/**
 * Lookup helper for budget-progress rendering. Returns 0 when no spend
 * exists in that (category, personTag) bucket.
 */
export function lookupCategorySpend(
  totals: CategoryTotal[],
  categoryId: string | null,
): number {
  const hit = totals.find((t) => t.categoryId === categoryId);
  return hit ? hit.total.amountMinor : 0;
}
