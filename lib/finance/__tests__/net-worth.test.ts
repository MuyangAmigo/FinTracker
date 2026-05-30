import { describe, expect, it } from "vitest";

import {
  latestNetWorth,
  monthlyNetWorthSeries,
  monthsBetween,
  type AccountRow,
  type SnapshotRow,
} from "@/lib/finance/net-worth";

function snap(
  accountId: string,
  asOf: string,
  balanceMinor: bigint,
): SnapshotRow {
  return { accountId, asOf: new Date(asOf), balanceMinor, currency: "CNY" };
}

describe("monthsBetween", () => {
  it("returns a list of month ranges inclusive of both endpoints", () => {
    const m = monthsBetween(
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-04-02T00:00:00Z"),
    );
    expect(m.map((r) => r.key)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
  });

  it("walks through year boundaries", () => {
    const m = monthsBetween(
      new Date("2025-11-30T00:00:00Z"),
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(m.map((r) => r.key)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("returns empty when end is before start", () => {
    expect(
      monthsBetween(
        new Date("2026-03-01T00:00:00Z"),
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).toHaveLength(0);
  });
});

describe("monthlyNetWorthSeries", () => {
  const accounts: AccountRow[] = [
    { id: "a-cash", kind: "CASH" },
    { id: "a-bank", kind: "BANK" },
    { id: "a-invest", kind: "INVESTMENT" },
  ];

  it("returns empty result when no snapshots", () => {
    const result = monthlyNetWorthSeries([], accounts, {
      baseCurrency: "CNY",
    });
    expect(result).toEqual({
      currency: "CNY",
      points: [],
      presentKinds: [],
    });
  });

  it("carries the most recent snapshot forward per account", () => {
    const snapshots: SnapshotRow[] = [
      snap("a-cash", "2026-01-31", 100_000n),
      snap("a-bank", "2026-01-31", 500_000n),
      snap("a-bank", "2026-03-31", 700_000n),
    ];
    const result = monthlyNetWorthSeries(snapshots, accounts, {
      baseCurrency: "CNY",
    });
    expect(result.points.map((p) => p.monthKey)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);

    const jan = result.points[0];
    expect(jan.byKindMinor.CASH).toBe(100_000);
    expect(jan.byKindMinor.BANK).toBe(500_000);
    expect(jan.totalMinor).toBe(600_000);

    const feb = result.points[1];
    // No new snapshot in Feb: balances carry forward.
    expect(feb.byKindMinor.CASH).toBe(100_000);
    expect(feb.byKindMinor.BANK).toBe(500_000);
    expect(feb.totalMinor).toBe(600_000);

    const mar = result.points[2];
    expect(mar.byKindMinor.BANK).toBe(700_000);
    expect(mar.totalMinor).toBe(800_000);
  });

  it("sums multiple accounts of the same kind", () => {
    const more: AccountRow[] = [...accounts, { id: "a-bank2", kind: "BANK" }];
    const snapshots: SnapshotRow[] = [
      snap("a-bank", "2026-01-31", 300_000n),
      snap("a-bank2", "2026-01-31", 200_000n),
    ];
    const result = monthlyNetWorthSeries(snapshots, more, {
      baseCurrency: "CNY",
    });
    expect(result.points[0].byKindMinor.BANK).toBe(500_000);
  });

  it("respects from/to window endpoints", () => {
    const snapshots: SnapshotRow[] = [
      snap("a-cash", "2025-06-30", 50_000n),
      snap("a-cash", "2026-03-31", 90_000n),
    ];
    const result = monthlyNetWorthSeries(snapshots, accounts, {
      baseCurrency: "CNY",
      from: new Date("2026-01-15T00:00:00Z"),
      to: new Date("2026-03-15T00:00:00Z"),
    });
    expect(result.points.map((p) => p.monthKey)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    // First two months still carry the 2025-06 balance forward.
    expect(result.points[0].byKindMinor.CASH).toBe(50_000);
    expect(result.points[1].byKindMinor.CASH).toBe(50_000);
    // March picks up the 2026-03-31 snapshot.
    expect(result.points[2].byKindMinor.CASH).toBe(90_000);
  });

  it("reports presentKinds only for kinds that ever had a non-zero balance", () => {
    const snapshots: SnapshotRow[] = [
      snap("a-cash", "2026-01-31", 100_000n),
    ];
    const result = monthlyNetWorthSeries(snapshots, accounts, {
      baseCurrency: "CNY",
    });
    expect(result.presentKinds).toEqual(["CASH"]);
  });

  it("handles a single-month window", () => {
    const snapshots: SnapshotRow[] = [
      snap("a-cash", "2026-01-31", 100_000n),
    ];
    const result = monthlyNetWorthSeries(snapshots, accounts, {
      baseCurrency: "CNY",
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-31T00:00:00Z"),
    });
    expect(result.points).toHaveLength(1);
    expect(result.points[0].monthKey).toBe("2026-01");
  });

  it("ignores accounts with no snapshot when computing kind totals", () => {
    const snapshots: SnapshotRow[] = [
      // Only the invest account has a snapshot; cash and bank stay 0.
      snap("a-invest", "2026-01-31", 1_234_500n),
    ];
    const result = monthlyNetWorthSeries(snapshots, accounts, {
      baseCurrency: "CNY",
    });
    expect(result.points[0].byKindMinor.INVESTMENT).toBe(1_234_500);
    expect(result.points[0].byKindMinor.CASH).toBe(0);
    expect(result.points[0].byKindMinor.BANK).toBe(0);
  });
});

describe("latestNetWorth", () => {
  it("returns null when no points", () => {
    expect(latestNetWorth({ currency: "CNY", points: [], presentKinds: [] })).toBeNull();
  });

  it("returns the final point's total as Money", () => {
    const result = latestNetWorth(
      monthlyNetWorthSeries(
        [snap("a", "2026-01-31", 100_000n), snap("a", "2026-02-28", 250_000n)],
        [{ id: "a", kind: "CASH" }],
        { baseCurrency: "CNY" },
      ),
    );
    expect(result).toEqual({ amountMinor: 250_000, currency: "CNY" });
  });
});
