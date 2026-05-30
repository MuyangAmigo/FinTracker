import { describe, expect, it } from "vitest";

import {
  monthlyCashFlowSeries,
  rollingTwelveMonthRange,
  type CashFlowTxn,
} from "@/lib/finance/cash-flow";

function txn(partial: {
  kind: CashFlowTxn["kind"];
  amountMinor: bigint;
  occurredOn: string;
  categoryId?: string | null;
  personTag?: string | null;
}): CashFlowTxn {
  return {
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    occurredOn: new Date(partial.occurredOn),
    currency: "CNY",
    categoryId: partial.categoryId ?? null,
    personTag: partial.personTag ?? null,
  };
}

describe("monthlyCashFlowSeries", () => {
  it("returns empty when no transactions", () => {
    expect(monthlyCashFlowSeries([], { baseCurrency: "CNY" })).toEqual({
      currency: "CNY",
      points: [],
    });
  });

  it("buckets transactions by month and emits zero-filled gaps", () => {
    const txns: CashFlowTxn[] = [
      txn({ kind: "INCOME", amountMinor: 1_000_000n, occurredOn: "2026-01-15" }),
      txn({ kind: "EXPENSE", amountMinor: 200_000n, occurredOn: "2026-01-20" }),
      txn({ kind: "INCOME", amountMinor: 500_000n, occurredOn: "2026-03-10" }),
    ];
    const result = monthlyCashFlowSeries(txns, { baseCurrency: "CNY" });

    expect(result.points.map((p) => p.monthKey)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(result.points[0].income.amountMinor).toBe(1_000_000);
    expect(result.points[0].expense.amountMinor).toBe(200_000);
    expect(result.points[0].savingsRate).toBeCloseTo(0.8, 5);

    // Feb has nothing → income 0, rate null.
    expect(result.points[1].income.amountMinor).toBe(0);
    expect(result.points[1].savingsRate).toBeNull();

    // March has income only.
    expect(result.points[2].income.amountMinor).toBe(500_000);
    expect(result.points[2].savings.amountMinor).toBe(500_000);
  });

  it("excludes transfers and investment cash-flows from savings", () => {
    const txns: CashFlowTxn[] = [
      txn({ kind: "INCOME", amountMinor: 1_000_000n, occurredOn: "2026-02-01" }),
      txn({ kind: "TRANSFER", amountMinor: 800_000n, occurredOn: "2026-02-05" }),
      txn({
        kind: "INVESTMENT_CONTRIBUTION",
        amountMinor: 300_000n,
        occurredOn: "2026-02-10",
      }),
      txn({ kind: "EXPENSE", amountMinor: 100_000n, occurredOn: "2026-02-15" }),
    ];
    const result = monthlyCashFlowSeries(txns, { baseCurrency: "CNY" });
    expect(result.points).toHaveLength(1);
    expect(result.points[0].savings.amountMinor).toBe(900_000);
    expect(result.points[0].savingsRate).toBeCloseTo(0.9, 5);
  });

  it("honours custom from/to window", () => {
    const txns: CashFlowTxn[] = [
      txn({ kind: "INCOME", amountMinor: 1_000_000n, occurredOn: "2026-02-15" }),
    ];
    const result = monthlyCashFlowSeries(txns, {
      baseCurrency: "CNY",
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-04-30T00:00:00Z"),
    });
    expect(result.points.map((p) => p.monthKey)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
  });
});

describe("rollingTwelveMonthRange", () => {
  it("spans 12 months ending at the given month", () => {
    const r = rollingTwelveMonthRange(new Date("2026-05-18T16:00:00Z"));
    expect(r.from.toISOString().slice(0, 10)).toBe("2025-06-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-05-31");
  });

  it("walks through year boundaries", () => {
    const r = rollingTwelveMonthRange(new Date("2026-02-15T00:00:00Z"));
    expect(r.from.toISOString().slice(0, 10)).toBe("2025-03-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});
