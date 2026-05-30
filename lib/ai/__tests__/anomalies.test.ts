import { describe, expect, it } from "vitest";

import {
  buildAnomalyReport,
  buildCategoryBaselines,
  detectAnomalies,
  LOOKBACK_MONTHS,
  MIN_ABS_DEVIATION_MINOR,
  MIN_SAMPLE_SIZE,
  TOP_N_ANOMALIES,
  Z_THRESHOLD,
  type AnomalyTxnRow,
} from "@/lib/ai/anomalies";
import { buildMockAnomalyResponse } from "@/lib/ai/foundry";

/*
 * `now` is anchored at 2026-05-15 UTC so the current-month range is
 * 2026-05-01 → 2026-05-31. The lookback window is 2025-11-01 → 2026-04-30
 * (6 months excluding the current month).
 */
const NOW = new Date("2026-05-15T12:00:00.000Z");

const CATEGORIES = [
  { id: "cat-lifestyle", name: "Lifestyle / 玩乐金" },
  { id: "cat-groceries", name: "Groceries / 食杂" },
  { id: "cat-rent", name: "Rent / 房租" },
];

function txn(
  partial: Partial<AnomalyTxnRow> & { id: string; occurredOn: string },
): AnomalyTxnRow {
  return {
    id: partial.id,
    kind: partial.kind ?? "EXPENSE",
    amountMinor: partial.amountMinor ?? BigInt(0),
    currency: partial.currency ?? "CNY",
    categoryId: partial.categoryId ?? "cat-lifestyle",
    personTag: partial.personTag ?? null,
    occurredOn: new Date(partial.occurredOn + "T00:00:00.000Z"),
  };
}

describe("anomalies — defaults", () => {
  it("exposes the documented constants", () => {
    expect(LOOKBACK_MONTHS).toBe(6);
    expect(MIN_SAMPLE_SIZE).toBe(5);
    expect(Z_THRESHOLD).toBe(2.0);
    expect(MIN_ABS_DEVIATION_MINOR).toBe(5_000);
    expect(TOP_N_ANOMALIES).toBe(10);
  });
});

describe("buildCategoryBaselines", () => {
  it("computes mean + sample stddev over the lookback window", () => {
    // 5 lifestyle EXPENSE rows across the lookback window, amounts 100,200,300,400,500.
    // Mean = 300. Sample variance (n-1) = (200²+100²+0+100²+200²)/4 = 25000. σ ≈ 158.114.
    const txns = [
      txn({ id: "h1", occurredOn: "2025-12-15", amountMinor: BigInt(100) }),
      txn({ id: "h2", occurredOn: "2026-01-15", amountMinor: BigInt(200) }),
      txn({ id: "h3", occurredOn: "2026-02-15", amountMinor: BigInt(300) }),
      txn({ id: "h4", occurredOn: "2026-03-15", amountMinor: BigInt(400) }),
      txn({ id: "h5", occurredOn: "2026-04-15", amountMinor: BigInt(500) }),
    ];
    const baselines = buildCategoryBaselines(
      { transactions: txns, categories: CATEGORIES },
      { now: NOW },
    );
    expect(baselines).toHaveLength(1);
    const b = baselines[0];
    expect(b.key).toEqual({ categoryId: "cat-lifestyle", kind: "EXPENSE" });
    expect(b.count).toBe(5);
    expect(b.meanMinor).toBe(300);
    expect(b.stddevMinor).toBeCloseTo(158.1138, 3);
    expect(b.sampleStart.toISOString().slice(0, 10)).toBe("2025-12-15");
    expect(b.sampleEnd.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("excludes current-month rows from the baseline", () => {
    // 5 historical rows + 3 current-month rows: only the historical 5 should count.
    const txns = [
      txn({ id: "h1", occurredOn: "2025-12-15", amountMinor: BigInt(100) }),
      txn({ id: "h2", occurredOn: "2026-01-15", amountMinor: BigInt(100) }),
      txn({ id: "h3", occurredOn: "2026-02-15", amountMinor: BigInt(100) }),
      txn({ id: "h4", occurredOn: "2026-03-15", amountMinor: BigInt(100) }),
      txn({ id: "h5", occurredOn: "2026-04-15", amountMinor: BigInt(100) }),
      txn({ id: "c1", occurredOn: "2026-05-02", amountMinor: BigInt(9_999) }),
      txn({ id: "c2", occurredOn: "2026-05-10", amountMinor: BigInt(9_999) }),
      txn({ id: "c3", occurredOn: "2026-05-20", amountMinor: BigInt(9_999) }),
    ];
    const baselines = buildCategoryBaselines(
      { transactions: txns, categories: CATEGORIES },
      { now: NOW },
    );
    expect(baselines[0].count).toBe(5);
    expect(baselines[0].meanMinor).toBe(100);
  });

  it("drops groups below MIN_SAMPLE_SIZE", () => {
    const txns = [
      // 4 rows for groceries (under the 5-row floor) — should be dropped.
      txn({
        id: "g1",
        categoryId: "cat-groceries",
        occurredOn: "2026-01-10",
        amountMinor: BigInt(100),
      }),
      txn({
        id: "g2",
        categoryId: "cat-groceries",
        occurredOn: "2026-02-10",
        amountMinor: BigInt(100),
      }),
      txn({
        id: "g3",
        categoryId: "cat-groceries",
        occurredOn: "2026-03-10",
        amountMinor: BigInt(100),
      }),
      txn({
        id: "g4",
        categoryId: "cat-groceries",
        occurredOn: "2026-04-10",
        amountMinor: BigInt(100),
      }),
    ];
    const baselines = buildCategoryBaselines(
      { transactions: txns, categories: CATEGORIES },
      { now: NOW },
    );
    expect(baselines).toHaveLength(0);
  });

  it("keeps separate buckets for the same category with different kinds", () => {
    const mkTxn = (id: string, kind: "EXPENSE" | "TRANSFER", amount: number) =>
      txn({
        id,
        kind,
        occurredOn: "2026-02-01",
        amountMinor: BigInt(amount),
      });
    const rows = [
      mkTxn("e1", "EXPENSE", 100),
      mkTxn("e2", "EXPENSE", 100),
      mkTxn("e3", "EXPENSE", 100),
      mkTxn("e4", "EXPENSE", 100),
      mkTxn("e5", "EXPENSE", 100),
      mkTxn("t1", "TRANSFER", 500),
      mkTxn("t2", "TRANSFER", 500),
      mkTxn("t3", "TRANSFER", 500),
      mkTxn("t4", "TRANSFER", 500),
      mkTxn("t5", "TRANSFER", 500),
    ];
    const baselines = buildCategoryBaselines(
      { transactions: rows, categories: CATEGORIES },
      { now: NOW },
    );
    expect(baselines).toHaveLength(2);
    const expense = baselines.find((b) => b.key.kind === "EXPENSE")!;
    const transfer = baselines.find((b) => b.key.kind === "TRANSFER")!;
    expect(expense.meanMinor).toBe(100);
    expect(transfer.meanMinor).toBe(500);
  });
});

describe("detectAnomalies", () => {
  function lifestyleBaseline() {
    // Lifestyle EXPENSE baseline with mean=100_000 (¥1,000), σ≈10_000 (¥100).
    const historical: AnomalyTxnRow[] = [
      txn({ id: "h1", occurredOn: "2025-12-05", amountMinor: BigInt(90_000) }),
      txn({ id: "h2", occurredOn: "2026-01-05", amountMinor: BigInt(95_000) }),
      txn({ id: "h3", occurredOn: "2026-02-05", amountMinor: BigInt(100_000) }),
      txn({ id: "h4", occurredOn: "2026-03-05", amountMinor: BigInt(105_000) }),
      txn({ id: "h5", occurredOn: "2026-04-05", amountMinor: BigInt(110_000) }),
    ];
    const baselines = buildCategoryBaselines(
      { transactions: historical, categories: CATEGORIES },
      { now: NOW },
    );
    return { baselines, historical };
  }

  it("flags a current-month txn above the z-threshold and abs-floor", () => {
    const { baselines, historical } = lifestyleBaseline();
    // ¥1,800 ⇒ deviation ¥800 (80_000 minor) ⇒ z ≈ 5.06 — well above 2.0.
    const current = txn({
      id: "c1",
      occurredOn: "2026-05-04",
      amountMinor: BigInt(180_000),
    });
    const result = detectAnomalies(
      { transactions: [...historical, current], baselines },
      { now: NOW },
    );
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].txnId).toBe("c1");
    expect(result.anomalies[0].ref).toBe("anom-1");
    expect(result.anomalies[0].direction).toBe("above");
    expect(result.anomalies[0].zScore).toBeGreaterThan(Z_THRESHOLD);
    expect(result.anomalies[0].baseline.sampleCount).toBe(5);
    expect(result.totalCandidates).toBe(1);
    expect(result.suppressedByCap).toBe(0);
  });

  it("respects MIN_ABS_DEVIATION_MINOR even when z-score is high", () => {
    // Mean 100, σ 10. Deviation of 50 (¥0.50) ⇒ z=5 but below ¥50 abs floor.
    const tiny: AnomalyTxnRow[] = [
      txn({ id: "h1", occurredOn: "2025-12-05", amountMinor: BigInt(90) }),
      txn({ id: "h2", occurredOn: "2026-01-05", amountMinor: BigInt(95) }),
      txn({ id: "h3", occurredOn: "2026-02-05", amountMinor: BigInt(100) }),
      txn({ id: "h4", occurredOn: "2026-03-05", amountMinor: BigInt(105) }),
      txn({ id: "h5", occurredOn: "2026-04-05", amountMinor: BigInt(110) }),
    ];
    const baselines = buildCategoryBaselines(
      { transactions: tiny, categories: CATEGORIES },
      { now: NOW },
    );
    const current = txn({
      id: "c1",
      occurredOn: "2026-05-04",
      amountMinor: BigInt(150),
    });
    const result = detectAnomalies(
      { transactions: [...tiny, current], baselines },
      { now: NOW },
    );
    expect(result.anomalies).toHaveLength(0);
  });

  it("does not flag transactions whose category has no baseline", () => {
    const { baselines } = lifestyleBaseline();
    // Different category — not in baseline map.
    const current = txn({
      id: "c1",
      occurredOn: "2026-05-04",
      categoryId: "cat-rent",
      amountMinor: BigInt(1_000_000),
    });
    const result = detectAnomalies(
      { transactions: [current], baselines },
      { now: NOW },
    );
    expect(result.anomalies).toHaveLength(0);
  });

  it("caps results at TOP_N_ANOMALIES and reports the suppression count", () => {
    const { baselines, historical } = lifestyleBaseline();
    // 12 current-month outliers — only the top 10 should come back.
    const current: AnomalyTxnRow[] = Array.from({ length: 12 }).map((_, i) =>
      txn({
        id: `c${i}`,
        occurredOn: "2026-05-04",
        // Vary so z-scores are distinct and sortable.
        amountMinor: BigInt(180_000 + i * 1_000),
      }),
    );
    const result = detectAnomalies(
      { transactions: [...historical, ...current], baselines },
      { now: NOW, topN: 10 },
    );
    expect(result.anomalies).toHaveLength(10);
    expect(result.totalCandidates).toBe(12);
    expect(result.suppressedByCap).toBe(2);
    // Refs are 1..10 in order.
    expect(result.anomalies.map((a) => a.ref)).toEqual([
      "anom-1",
      "anom-2",
      "anom-3",
      "anom-4",
      "anom-5",
      "anom-6",
      "anom-7",
      "anom-8",
      "anom-9",
      "anom-10",
    ]);
  });
});

describe("buildAnomalyReport + mock response", () => {
  it("buildAnomalyReport rolls baselines and anomalies into one snapshot", () => {
    const txns: AnomalyTxnRow[] = [
      txn({ id: "h1", occurredOn: "2025-12-05", amountMinor: BigInt(90_000) }),
      txn({ id: "h2", occurredOn: "2026-01-05", amountMinor: BigInt(95_000) }),
      txn({ id: "h3", occurredOn: "2026-02-05", amountMinor: BigInt(100_000) }),
      txn({ id: "h4", occurredOn: "2026-03-05", amountMinor: BigInt(105_000) }),
      txn({ id: "h5", occurredOn: "2026-04-05", amountMinor: BigInt(110_000) }),
      txn({ id: "c1", occurredOn: "2026-05-04", amountMinor: BigInt(200_000) }),
    ];
    const report = buildAnomalyReport(
      { baseCurrency: "CNY", transactions: txns, categories: CATEGORIES },
      { now: NOW },
    );
    expect(report.baseCurrency).toBe("CNY");
    expect(report.current.monthKey).toBe("2026-05");
    expect(report.lookback.months).toBe(6);
    expect(report.lookback.start).toBe("2025-11-01");
    expect(report.lookback.end).toBe("2026-04-30");
    expect(report.baselines).toHaveLength(1);
    expect(report.anomalies).toHaveLength(1);
    expect(report.anomalies[0].txnId).toBe("c1");
    expect(report.totalCandidates).toBe(1);
  });

  it("buildMockAnomalyResponse produces a schema-valid explanation per flag", () => {
    const txns: AnomalyTxnRow[] = [
      txn({ id: "h1", occurredOn: "2025-12-05", amountMinor: BigInt(50_000) }),
      txn({ id: "h2", occurredOn: "2026-01-05", amountMinor: BigInt(50_000) }),
      txn({ id: "h3", occurredOn: "2026-02-05", amountMinor: BigInt(50_000) }),
      txn({ id: "h4", occurredOn: "2026-03-05", amountMinor: BigInt(60_000) }),
      txn({ id: "h5", occurredOn: "2026-04-05", amountMinor: BigInt(70_000) }),
      // Two current-month outliers, very different magnitudes for varied severity.
      txn({ id: "c1", occurredOn: "2026-05-04", amountMinor: BigInt(300_000) }),
      txn({ id: "c2", occurredOn: "2026-05-22", amountMinor: BigInt(180_000) }),
    ];
    const report = buildAnomalyReport(
      { baseCurrency: "CNY", transactions: txns, categories: CATEGORIES },
      { now: NOW },
    );
    expect(report.anomalies.length).toBeGreaterThan(0);
    const mock = buildMockAnomalyResponse(report);
    expect(mock.title).toContain("2026-05");
    expect(mock.anomalies).toHaveLength(report.anomalies.length);
    const refs = report.anomalies.map((a) => a.ref);
    expect(mock.anomalies.map((a) => a.ref)).toEqual(refs);
    for (const a of mock.anomalies) {
      expect(["low", "medium", "high"]).toContain(a.severity);
      // Mock renders amounts in the household base currency; CNY can format
      // as the "CN¥" symbol or the "CNY" code depending on the Node/Intl
      // locale data, so accept either.
      expect(a.explanation).toMatch(/CN¥|CNY/);
    }
    expect(mock.flags.length).toBeGreaterThan(0);
    expect(mock.recommendations.length).toBeGreaterThan(0);
  });

  it("buildMockAnomalyResponse handles the empty-anomalies case", () => {
    // All quiet — no current-month rows at all.
    const txns: AnomalyTxnRow[] = [
      txn({ id: "h1", occurredOn: "2025-12-05", amountMinor: BigInt(100) }),
      txn({ id: "h2", occurredOn: "2026-01-05", amountMinor: BigInt(100) }),
      txn({ id: "h3", occurredOn: "2026-02-05", amountMinor: BigInt(100) }),
      txn({ id: "h4", occurredOn: "2026-03-05", amountMinor: BigInt(100) }),
      txn({ id: "h5", occurredOn: "2026-04-05", amountMinor: BigInt(100) }),
    ];
    const report = buildAnomalyReport(
      { baseCurrency: "CNY", transactions: txns, categories: CATEGORIES },
      { now: NOW },
    );
    expect(report.anomalies).toHaveLength(0);
    const mock = buildMockAnomalyResponse(report);
    expect(mock.anomalies).toHaveLength(0);
    expect(mock.flags[0].kind).toBe("positive");
  });
});
