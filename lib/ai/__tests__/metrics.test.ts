import { describe, expect, it } from "vitest";

import {
  buildInsightMetrics,
  type BuildInsightMetricsInput,
} from "@/lib/ai/metrics";
import type { TxnRow } from "@/lib/finance/aggregates";

/*
 * Anchored at 2026-04-15 UTC so "current month" is April 2026 and the
 * previous-month delta uses March 2026 — fixed dates make the assertions
 * deterministic regardless of when tests run.
 */
const NOW = new Date("2026-04-15T00:00:00.000Z");

function makeTxn(
  partial: Partial<TxnRow & { occurredOn: Date }> & Pick<TxnRow, "kind">,
): TxnRow & { occurredOn: Date } {
  return {
    kind: partial.kind,
    amountMinor: partial.amountMinor ?? 0n,
    currency: partial.currency ?? "CNY",
    categoryId: partial.categoryId ?? null,
    personTag: partial.personTag ?? null,
    occurredOn: partial.occurredOn ?? new Date("2026-04-10T00:00:00.000Z"),
  };
}

function baseInput(
  overrides: Partial<BuildInsightMetricsInput> = {},
): BuildInsightMetricsInput {
  return {
    baseCurrency: "CNY",
    savingsGoalRate: 0.6,
    transactions: [],
    snapshots: [],
    accounts: [],
    categories: [],
    now: NOW,
    ...overrides,
  };
}

describe("buildInsightMetrics", () => {
  it("returns zeroed totals for an empty input", () => {
    const m = buildInsightMetrics(baseInput());

    expect(m.current.monthKey).toBe("2026-04");
    expect(m.previous.monthKey).toBe("2026-03");
    expect(m.current.income.amountMinor).toBe(0);
    expect(m.current.expense.amountMinor).toBe(0);
    expect(m.current.savingsRate).toBeNull();
    expect(m.monthOverMonth.incomeDeltaMinor).toBe(0);
    expect(m.monthOverMonth.savingsRateDelta).toBeNull();
    expect(m.netWorth.currentMinor).toBeNull();
    expect(m.netWorth.deltaMinor).toBeNull();
    expect(m.topCategories).toEqual([]);
    expect(m.personShares).toEqual([]);
  });

  it("splits transactions across current and previous month", () => {
    const m = buildInsightMetrics(
      baseInput({
        transactions: [
          // March (previous)
          makeTxn({
            kind: "INCOME",
            amountMinor: 1_000_000n,
            occurredOn: new Date("2026-03-05T00:00:00.000Z"),
          }),
          makeTxn({
            kind: "EXPENSE",
            amountMinor: 600_000n,
            occurredOn: new Date("2026-03-20T00:00:00.000Z"),
          }),
          // April (current)
          makeTxn({
            kind: "INCOME",
            amountMinor: 1_500_000n,
            occurredOn: new Date("2026-04-02T00:00:00.000Z"),
          }),
          makeTxn({
            kind: "EXPENSE",
            amountMinor: 500_000n,
            occurredOn: new Date("2026-04-08T00:00:00.000Z"),
          }),
        ],
      }),
    );

    expect(m.previous.income.amountMinor).toBe(1_000_000);
    expect(m.previous.expense.amountMinor).toBe(600_000);
    expect(m.previous.savingsRate).toBeCloseTo(0.4, 3);

    expect(m.current.income.amountMinor).toBe(1_500_000);
    expect(m.current.expense.amountMinor).toBe(500_000);
    expect(m.current.savingsRate).toBeCloseTo(2 / 3, 3);

    expect(m.monthOverMonth.incomeDeltaMinor).toBe(500_000);
    expect(m.monthOverMonth.expenseDeltaMinor).toBe(-100_000);
    expect(m.monthOverMonth.savingsDeltaMinor).toBe(600_000);
    expect(m.monthOverMonth.savingsRateDelta).toBeCloseTo(2 / 3 - 0.4, 3);
  });

  it("ranks top categories and person shares for the current month only", () => {
    const m = buildInsightMetrics(
      baseInput({
        categories: [
          { id: "groc", name: "Groceries", nameZh: "杂货" },
          { id: "rent", name: "Rent", nameZh: null },
        ],
        transactions: [
          // current-month expenses
          makeTxn({
            kind: "EXPENSE",
            amountMinor: 800_000n,
            categoryId: "rent",
            personTag: "junjie",
            occurredOn: new Date("2026-04-03T00:00:00.000Z"),
          }),
          makeTxn({
            kind: "EXPENSE",
            amountMinor: 200_000n,
            categoryId: "groc",
            personTag: "jinyou",
            occurredOn: new Date("2026-04-12T00:00:00.000Z"),
          }),
          // previous-month expense ignored
          makeTxn({
            kind: "EXPENSE",
            amountMinor: 999_999n,
            categoryId: "groc",
            personTag: "junjie",
            occurredOn: new Date("2026-03-15T00:00:00.000Z"),
          }),
        ],
      }),
    );

    expect(m.topCategories.length).toBe(2);
    expect(m.topCategories[0].label).toBe("Rent");
    expect(m.topCategories[0].amountMinor).toBe(800_000);
    expect(m.topCategories[0].share).toBeCloseTo(0.8, 3);
    expect(m.topCategories[1].label).toBe("Groceries · 杂货");

    expect(m.personShares.length).toBe(2);
    expect(m.personShares[0].personTag).toBe("junjie");
    expect(m.personShares[0].share).toBeCloseTo(0.8, 3);
  });

  it("computes net-worth delta when straddling snapshots exist", () => {
    const m = buildInsightMetrics(
      baseInput({
        accounts: [{ id: "acct-1", kind: "BANK" }],
        snapshots: [
          {
            accountId: "acct-1",
            asOf: new Date("2026-03-31T00:00:00.000Z"),
            balanceMinor: 10_000_000n,
            currency: "CNY",
          },
          {
            accountId: "acct-1",
            asOf: new Date("2026-04-30T00:00:00.000Z"),
            balanceMinor: 12_000_000n,
            currency: "CNY",
          },
        ],
      }),
    );

    expect(m.netWorth.previousMinor).toBe(10_000_000);
    expect(m.netWorth.currentMinor).toBe(12_000_000);
    expect(m.netWorth.deltaMinor).toBe(2_000_000);
  });

  it("records household counts on the snapshot", () => {
    const m = buildInsightMetrics(
      baseInput({
        accounts: [{ id: "a", kind: "BANK" }],
        categories: [{ id: "c", name: "Misc", nameZh: null }],
        snapshots: [
          {
            accountId: "a",
            asOf: new Date("2026-04-30T00:00:00.000Z"),
            balanceMinor: 1n,
            currency: "CNY",
          },
        ],
        transactions: [
          makeTxn({
            kind: "EXPENSE",
            amountMinor: 1n,
            categoryId: "c",
            occurredOn: new Date("2026-04-01T00:00:00.000Z"),
          }),
        ],
      }),
    );

    expect(m.household.accountCount).toBe(1);
    expect(m.household.categoryCount).toBe(1);
    expect(m.household.snapshotCount).toBe(1);
    expect(m.household.transactionCount).toBe(1);
    expect(m.baseCurrency).toBe("CNY");
    expect(m.savingsGoalRate).toBe(0.6);
  });
});
