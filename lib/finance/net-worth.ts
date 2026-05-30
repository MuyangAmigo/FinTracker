/*
 * Net-worth aggregation from AccountSnapshot rows.
 *
 * AccountSnapshot stores point-in-time balances per account (typically
 * month-end). For each month in the requested window we use the most recent
 * snapshot on or before the month-end for every active account, then sum
 * those balances grouped by AccountKind so the dashboard can render a
 * stacked-area trend.
 *
 * Money is in integer minor units throughout. Multi-currency aggregation is
 * intentionally NOT done here — Phase-6 assumes one base currency per
 * household and treats snapshots in other currencies as if already in base
 * (a fair simplification while the dataset is CNY-dominant; revisit when
 * FX hits the schema).
 */

import { monthRange, type MonthRange } from "@/lib/finance/period";
import type { Money } from "@/lib/money";

export type AccountKind =
  | "CASH"
  | "BANK"
  | "WALLET"
  | "CREDIT_CARD"
  | "BROKERAGE"
  | "ESPP"
  | "INSURANCE"
  | "INVESTMENT"
  | "LIABILITY"
  | "OTHER";

export interface SnapshotRow {
  accountId: string;
  asOf: Date;
  balanceMinor: bigint;
  currency: string;
}

export interface AccountRow {
  id: string;
  kind: AccountKind;
}

export interface NetWorthPoint {
  /** YYYY-MM key for the month-end. */
  monthKey: string;
  /** ISO date string for the month-end (YYYY-MM-DD). */
  monthEnd: string;
  totalMinor: number;
  /** Per-AccountKind subtotal. Kinds with no balance for this month are 0. */
  byKindMinor: Record<AccountKind, number>;
}

export interface NetWorthSeries {
  currency: string;
  points: NetWorthPoint[];
  /** Stable order of kinds that ever appeared in the window (sum > 0). */
  presentKinds: AccountKind[];
}

const ZERO = BigInt(0);

const ALL_KINDS: AccountKind[] = [
  "CASH",
  "BANK",
  "WALLET",
  "CREDIT_CARD",
  "BROKERAGE",
  "ESPP",
  "INSURANCE",
  "INVESTMENT",
  "LIABILITY",
  "OTHER",
];

function emptyKindRecord(): Record<AccountKind, number> {
  const r = {} as Record<AccountKind, number>;
  for (const k of ALL_KINDS) r[k] = 0;
  return r;
}

/**
 * Enumerate month ranges from `start` through `end` inclusive of both
 * endpoints' months.
 */
export function monthsBetween(start: Date, end: Date): MonthRange[] {
  if (end.getTime() < start.getTime()) return [];
  const out: MonthRange[] = [];
  let cursor = monthRange(start.getUTCFullYear(), start.getUTCMonth());
  const lastKey = monthRange(end.getUTCFullYear(), end.getUTCMonth()).key;
  out.push(cursor);
  while (cursor.key !== lastKey) {
    cursor = monthRange(
      cursor.start.getUTCFullYear(),
      cursor.start.getUTCMonth() + 1,
    );
    out.push(cursor);
  }
  return out;
}

export interface NetWorthOptions {
  /** Earliest month-end to include. Defaults to the oldest snapshot. */
  from?: Date;
  /** Latest month-end to include. Defaults to the latest snapshot or now. */
  to?: Date;
  /** Reporting currency label propagated onto the series. */
  baseCurrency: string;
}

/**
 * Build a monthly net-worth time series stacked by AccountKind.
 *
 * Algorithm:
 *   1. Sort snapshots ascending per account.
 *   2. For each month-end in the window, advance the per-account cursor to
 *      the last snapshot with asOf <= monthEnd.
 *   3. Sum the per-account current balances grouped by the account's kind.
 *
 * Net cost: O(snapshots + accounts * months) but in practice both are
 * small — months ~ 60, accounts ~ 12 over the legacy 2022-2026 dataset.
 */
export function monthlyNetWorthSeries(
  snapshots: SnapshotRow[],
  accounts: AccountRow[],
  opts: NetWorthOptions,
): NetWorthSeries {
  if (snapshots.length === 0) {
    return { currency: opts.baseCurrency, points: [], presentKinds: [] };
  }

  const accountKind = new Map<string, AccountKind>();
  for (const a of accounts) accountKind.set(a.id, a.kind);

  // Snapshots grouped per account, sorted by asOf ascending.
  const byAccount = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    const bucket = byAccount.get(s.accountId);
    if (bucket) bucket.push(s);
    else byAccount.set(s.accountId, [s]);
  }
  for (const bucket of byAccount.values()) {
    bucket.sort((a, b) => a.asOf.getTime() - b.asOf.getTime());
  }

  // Determine window endpoints.
  let earliest = snapshots[0].asOf;
  let latest = snapshots[0].asOf;
  for (const s of snapshots) {
    if (s.asOf.getTime() < earliest.getTime()) earliest = s.asOf;
    if (s.asOf.getTime() > latest.getTime()) latest = s.asOf;
  }
  const from = opts.from ?? earliest;
  const to = opts.to ?? latest;
  const months = monthsBetween(from, to);

  // Per-account walking cursors into their sorted snapshot arrays.
  const cursors = new Map<string, number>();
  for (const id of byAccount.keys()) cursors.set(id, -1);

  const points: NetWorthPoint[] = [];
  const everPresent = new Set<AccountKind>();

  for (const month of months) {
    const byKindMinor = emptyKindRecord();
    let totalMinor = ZERO;
    for (const [accountId, snapshotList] of byAccount.entries()) {
      let cursor = cursors.get(accountId) ?? -1;
      while (
        cursor + 1 < snapshotList.length &&
        snapshotList[cursor + 1].asOf.getTime() <= month.end.getTime()
      ) {
        cursor++;
      }
      cursors.set(accountId, cursor);
      if (cursor < 0) continue;
      const balance = snapshotList[cursor].balanceMinor;
      const kind = accountKind.get(accountId) ?? "OTHER";
      byKindMinor[kind] += Number(balance);
      totalMinor += balance;
    }

    for (const k of ALL_KINDS) {
      if (byKindMinor[k] !== 0) everPresent.add(k);
    }

    points.push({
      monthKey: month.key,
      monthEnd: month.end.toISOString().slice(0, 10),
      totalMinor: Number(totalMinor),
      byKindMinor,
    });
  }

  const presentKinds = ALL_KINDS.filter((k) => everPresent.has(k));

  return { currency: opts.baseCurrency, points, presentKinds };
}

/**
 * Convenience wrapper that returns the latest point's total as a Money value
 * (or null when no snapshots are available).
 */
export function latestNetWorth(series: NetWorthSeries): Money | null {
  if (series.points.length === 0) return null;
  const last = series.points[series.points.length - 1];
  return { amountMinor: last.totalMinor, currency: series.currency };
}
