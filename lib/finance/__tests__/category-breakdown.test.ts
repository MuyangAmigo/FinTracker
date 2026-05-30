import { describe, expect, it } from "vitest";

import {
  buildCategoryBreakdown,
  type CategoryLookup,
} from "@/lib/finance/category-breakdown";
import type { TxnRow } from "@/lib/finance/aggregates";

function txn(partial: Partial<TxnRow> & Pick<TxnRow, "kind">): TxnRow {
  return {
    kind: partial.kind,
    amountMinor: partial.amountMinor ?? 0n,
    currency: partial.currency ?? "CNY",
    categoryId: partial.categoryId ?? null,
    personTag: partial.personTag ?? null,
  };
}

const categories: CategoryLookup[] = [
  { id: "cat-housing", name: "Housing", nameZh: "住房" },
  { id: "cat-dining", name: "Dining" },
  { id: "cat-coffee", name: "Coffee" },
  { id: "cat-misc-1", name: "Misc1" },
  { id: "cat-misc-2", name: "Misc2" },
];

describe("buildCategoryBreakdown", () => {
  it("returns empty when no spend", () => {
    const result = buildCategoryBreakdown([], categories, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
    });
    expect(result).toEqual({ currency: "CNY", totalMinor: 0, slices: [] });
  });

  it("sorts slices descending by amount and computes share", () => {
    const rows: TxnRow[] = [
      txn({
        kind: "EXPENSE",
        amountMinor: 300_000n,
        categoryId: "cat-housing",
      }),
      txn({
        kind: "EXPENSE",
        amountMinor: 150_000n,
        categoryId: "cat-dining",
      }),
      txn({
        kind: "EXPENSE",
        amountMinor: 50_000n,
        categoryId: "cat-coffee",
      }),
    ];
    const result = buildCategoryBreakdown(rows, categories, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
      otherThreshold: 0,
    });
    expect(result.totalMinor).toBe(500_000);
    expect(result.slices.map((s) => s.label)).toEqual([
      "Housing · 住房",
      "Dining",
      "Coffee",
    ]);
    expect(result.slices[0].share).toBeCloseTo(0.6);
    expect(result.slices[1].share).toBeCloseTo(0.3);
    expect(result.slices[2].share).toBeCloseTo(0.1);
  });

  it("collapses the tail into an Other bucket when threshold > 0", () => {
    const rows: TxnRow[] = [
      txn({
        kind: "EXPENSE",
        amountMinor: 1_000_000n,
        categoryId: "cat-housing",
      }),
      // Three sub-3% slices.
      txn({
        kind: "EXPENSE",
        amountMinor: 20_000n,
        categoryId: "cat-coffee",
      }),
      txn({
        kind: "EXPENSE",
        amountMinor: 15_000n,
        categoryId: "cat-misc-1",
      }),
      txn({
        kind: "EXPENSE",
        amountMinor: 10_000n,
        categoryId: "cat-misc-2",
      }),
    ];
    const result = buildCategoryBreakdown(rows, categories, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
      otherThreshold: 0.03,
    });
    expect(result.slices).toHaveLength(2);
    expect(result.slices[0].label).toBe("Housing · 住房");
    const other = result.slices[1];
    expect(other.isOther).toBe(true);
    expect(other.label).toBe("Other (3)");
    expect(other.amountMinor).toBe(45_000);
  });

  it("does not collapse a singleton tail", () => {
    const rows: TxnRow[] = [
      txn({
        kind: "EXPENSE",
        amountMinor: 1_000_000n,
        categoryId: "cat-housing",
      }),
      txn({
        kind: "EXPENSE",
        amountMinor: 20_000n,
        categoryId: "cat-coffee",
      }),
    ];
    const result = buildCategoryBreakdown(rows, categories, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
      otherThreshold: 0.03,
    });
    expect(result.slices.map((s) => s.label)).toEqual([
      "Housing · 住房",
      "Coffee",
    ]);
    expect(result.slices.every((s) => !s.isOther)).toBe(true);
  });

  it("labels the null categoryId as Uncategorised", () => {
    const rows: TxnRow[] = [
      txn({ kind: "EXPENSE", amountMinor: 100_000n, categoryId: null }),
    ];
    const result = buildCategoryBreakdown(rows, categories, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
      otherThreshold: 0,
    });
    expect(result.slices[0].label).toBe("Uncategorised");
  });

  it("narrows by personTag when supplied", () => {
    const rows: TxnRow[] = [
      txn({
        kind: "EXPENSE",
        amountMinor: 100_000n,
        categoryId: "cat-housing",
        personTag: "Junjie",
      }),
      txn({
        kind: "EXPENSE",
        amountMinor: 200_000n,
        categoryId: "cat-housing",
        personTag: "Jinyou",
      }),
    ];
    const junjie = buildCategoryBreakdown(rows, categories, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
      personTag: "Junjie",
    });
    expect(junjie.totalMinor).toBe(100_000);
    const jinyou = buildCategoryBreakdown(rows, categories, {
      baseCurrency: "CNY",
      kind: "EXPENSE",
      personTag: "Jinyou",
    });
    expect(jinyou.totalMinor).toBe(200_000);
  });
});
