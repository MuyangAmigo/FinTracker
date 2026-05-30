import { describe, expect, it } from "vitest";

import { buildMockResponse } from "@/lib/ai/foundry";
import { buildInsightMetrics } from "@/lib/ai/metrics";
import {
  insightResponseSchema,
  type InsightResponse,
} from "@/lib/ai/validate";
import { renderInsightMarkdown } from "@/lib/ai/insights";

const NOW = new Date("2026-04-15T00:00:00.000Z");

const sampleMetrics = buildInsightMetrics({
  baseCurrency: "CNY",
  savingsGoalRate: 0.6,
  transactions: [
    {
      kind: "INCOME",
      amountMinor: 2_000_000n,
      currency: "CNY",
      categoryId: null,
      personTag: "junjie",
      occurredOn: new Date("2026-04-02T00:00:00.000Z"),
    },
    {
      kind: "EXPENSE",
      amountMinor: 1_500_000n,
      currency: "CNY",
      categoryId: "groc",
      personTag: "junjie",
      occurredOn: new Date("2026-04-04T00:00:00.000Z"),
    },
    {
      kind: "INCOME",
      amountMinor: 2_000_000n,
      currency: "CNY",
      categoryId: null,
      personTag: "jinyou",
      occurredOn: new Date("2026-03-02T00:00:00.000Z"),
    },
    {
      kind: "EXPENSE",
      amountMinor: 700_000n,
      currency: "CNY",
      categoryId: "groc",
      personTag: "jinyou",
      occurredOn: new Date("2026-03-04T00:00:00.000Z"),
    },
  ],
  snapshots: [
    {
      accountId: "a1",
      asOf: new Date("2026-03-31T00:00:00.000Z"),
      balanceMinor: 5_000_000n,
      currency: "CNY",
    },
    {
      accountId: "a1",
      asOf: new Date("2026-04-30T00:00:00.000Z"),
      balanceMinor: 4_500_000n,
      currency: "CNY",
    },
  ],
  accounts: [{ id: "a1", kind: "BANK" }],
  categories: [{ id: "groc", name: "Groceries", nameZh: "杂货" }],
  now: NOW,
});

describe("insightResponseSchema", () => {
  it("rejects responses with too-short title or summary", () => {
    const result = insightResponseSchema.safeParse({
      title: "Bad",
      summary: "tiny",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a minimal valid response and defaults arrays", () => {
    const parsed = insightResponseSchema.parse({
      title: "April overview",
      summary:
        "Spending stayed within target this month with a healthy savings rate.",
    });
    expect(parsed.keyMetrics).toEqual([]);
    expect(parsed.recommendations).toEqual([]);
    expect(parsed.flags).toEqual([]);
  });
});

describe("buildMockResponse", () => {
  it("produces a schema-valid response derived from the metrics", () => {
    const response: InsightResponse = buildMockResponse(sampleMetrics);

    expect(() => insightResponseSchema.parse(response)).not.toThrow();
    expect(response.title).toContain("April 2026");
    expect(response.summary).toMatch(/April 2026/);
    expect(response.keyMetrics.length).toBeGreaterThan(0);
    expect(response.recommendations.length).toBeGreaterThan(0);
  });

  it("flags expense growth and net-worth dip", () => {
    const response = buildMockResponse(sampleMetrics);
    const kinds = response.flags.map((f) => f.kind);
    expect(kinds).toContain("watch");
    expect(
      response.recommendations.some((r) =>
        r.toLowerCase().includes("net worth"),
      ),
    ).toBe(true);
  });
});

describe("renderInsightMarkdown", () => {
  it("renders heading, summary, and sections", () => {
    const response = buildMockResponse(sampleMetrics);
    const md = renderInsightMarkdown(response);

    expect(md.startsWith("# ")).toBe(true);
    expect(md).toContain(response.title);
    expect(md).toContain("## Key metrics");
    expect(md).toContain("## Recommendations");
  });
});
