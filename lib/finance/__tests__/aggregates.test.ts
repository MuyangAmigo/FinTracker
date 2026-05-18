import { describe, expect, it } from "vitest";

import {
  lookupCategorySpend,
  monthlyIncomeExpenseSavings,
  monthlyTotalsByCategory,
  type TxnRow,
} from "@/lib/finance/aggregates";

function txn(partial: Partial<TxnRow> & Pick<TxnRow, "kind">): TxnRow {
  return {
    kind: partial.kind,
    amountMinor: partial.amountMinor ?? 0n,
    currency: partial.currency ?? "CNY",
    categoryId: partial.categoryId ?? null,
    personTag: partial.personTag ?? null,
  };
}

describe("monthlyIncomeExpenseSavings", () => {
  it("sums income, expense, and savings ignoring transfers", () => {
    const rows: TxnRow[] = [
      txn({ kind: "INCOME", amountMinor: 1_000_000n }),
      txn({ kind: "INCOME", amountMinor: 500_000n }),
      txn({ kind: "EXPENSE", amountMinor: 300_000n }),
      txn({ kind: "EXPENSE", amountMinor: 200_000n }),
      txn({ kind: "TRANSFER", amountMinor: 700_000n }),
      txn({ kind: "INVESTMENT_CONTRIBUTION", amountMinor: 400_000n }),
    ];

    const totals = monthlyIncomeExpenseSavings(rows, "CNY");

    expect(totals.income.amountMinor).toBe(1_500_000);
    expect(totals.expense.amountMinor).toBe(500_000);
    expect(totals.transferOut.amountMinor).toBe(700_000);
    expect(totals.savings.amountMinor).toBe(1_000_000);
    expect(totals.savingsRate).toBeCloseTo(0.6667, 3);
    expect(totals.currency).toBe("CNY");
  });

  it("returns null savings rate when income is zero", () => {
    const rows: TxnRow[] = [txn({ kind: "EXPENSE", amountMinor: 250_000n })];

    const totals = monthlyIncomeExpenseSavings(rows, "CNY");

    expect(totals.income.amountMinor).toBe(0);
    expect(totals.savingsRate).toBeNull();
    expect(totals.savings.amountMinor).toBe(-250_000);
  });

  it("handles empty input", () => {
    const totals = monthlyIncomeExpenseSavings([], "USD");
    expect(totals).toEqual({
      income: { amountMinor: 0, currency: "USD" },
      expense: { amountMinor: 0, currency: "USD" },
      transferOut: { amountMinor: 0, currency: "USD" },
      savings: { amountMinor: 0, currency: "USD" },
      savingsRate: null,
      currency: "USD",
    });
  });
});

describe("monthlyTotalsByCategory", () => {
  const rows: TxnRow[] = [
    txn({
      kind: "EXPENSE",
      amountMinor: 100_000n,
      categoryId: "cat-housing",
      personTag: "Junjie",
    }),
    txn({
      kind: "EXPENSE",
      amountMinor: 50_000n,
      categoryId: "cat-housing",
      personTag: "Jinyou",
    }),
    txn({
      kind: "EXPENSE",
      amountMinor: 75_000n,
      categoryId: "cat-dining",
      personTag: "Junjie",
    }),
    txn({
      kind: "INCOME",
      amountMinor: 9_000_000n,
      categoryId: "cat-salary",
      personTag: "Junjie",
    }),
    txn({
      kind: "EXPENSE",
      amountMinor: 25_000n,
      categoryId: null,
      personTag: null,
    }),
  ];

  it("groups by categoryId across personTag when no personTag filter is set", () => {
    const result = monthlyTotalsByCategory(rows, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
    });

    const housing = result.find((r) => r.categoryId === "cat-housing");
    const dining = result.find((r) => r.categoryId === "cat-dining");
    const uncategorised = result.find((r) => r.categoryId === null);

    expect(housing?.total.amountMinor).toBe(150_000);
    expect(dining?.total.amountMinor).toBe(75_000);
    expect(uncategorised?.total.amountMinor).toBe(25_000);
    expect(result.find((r) => r.categoryId === "cat-salary")).toBeUndefined();
  });

  it("narrows by personTag when supplied", () => {
    const result = monthlyTotalsByCategory(rows, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
      personTag: "Junjie",
    });

    expect(
      result.find((r) => r.categoryId === "cat-housing")?.total.amountMinor,
    ).toBe(100_000);
    expect(
      result.find((r) => r.categoryId === "cat-dining")?.total.amountMinor,
    ).toBe(75_000);
  });

  it("treats explicit null personTag as a filter", () => {
    const result = monthlyTotalsByCategory(rows, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
      personTag: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      categoryId: null,
      total: { amountMinor: 25_000, currency: "CNY" },
    });
  });
});

describe("lookupCategorySpend", () => {
  it("returns 0 when category not present", () => {
    expect(
      lookupCategorySpend(
        [
          {
            categoryId: "cat-a",
            total: { amountMinor: 100, currency: "CNY" },
          },
        ],
        "cat-missing",
      ),
    ).toBe(0);
  });

  it("returns the bucket total when present", () => {
    expect(
      lookupCategorySpend(
        [
          {
            categoryId: "cat-a",
            total: { amountMinor: 100, currency: "CNY" },
          },
        ],
        "cat-a",
      ),
    ).toBe(100);
  });
});
