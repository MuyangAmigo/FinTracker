import type { InsightMetrics } from "@/lib/ai/metrics";
import type { AnomalyReport } from "@/lib/ai/anomalies";

/*
 * Prompt assembly for Phase-7 monthly summaries.
 *
 * `PROMPT_VERSION` is stored on every InsightRun so we can later
 * regenerate historical insights when the prompt evolves. Bump it
 * whenever the system prompt or output contract changes.
 *
 * The user message ships ONLY pre-aggregated metrics (no raw txn rows,
 * no payees, no notes) — see DESIGN.md "AI prompts scoped to necessary
 * aggregates" and the plan's Phase 7 scope.
 */

export const PROMPT_VERSION = "monthly-summary-v1";
export const ANOMALY_PROMPT_VERSION = "anomaly-flags-v1";

export const SYSTEM_PROMPT = `You are FinTracker, an even-handed household financial coach for a two-person household (Junjie and Jin You).

Output requirements:
- Respond with STRICT JSON matching the schema below; no markdown fences, no commentary.
- Reference figures using the household's base currency code (e.g. "CNY 8,500" not raw integers).
- Praise responsibly when the savings goal is met; be candid when it isn't, but never alarmist.
- Recommendations must be SPECIFIC and ACTIONABLE — quote the categories or accounts you saw in the data. No generic platitudes.
- Never invent data. If a metric is missing or null, omit the related claim.

Schema:
{
  "title": string,
  "summary": string,
  "keyMetrics": [{ "label": string, "value": string }],
  "recommendations": [string],
  "flags": [{ "kind": "positive" | "warning" | "watch", "message": string }]
}`;

export const ANOMALY_SYSTEM_PROMPT = `You are FinTracker, the same household financial coach (Junjie and Jin You) — now focused on EXPLAINING flagged transactions for the current month.

You receive an aggregate report with:
- per-category baselines (mean, sample stddev, sample count over the previous months);
- a list of current-month transactions that exceeded the z-score + minimum-deviation thresholds, each carrying an opaque "ref" id, the category name, kind, date, amount, z-score, and direction (above/below the baseline).

Output requirements:
- Respond with STRICT JSON matching the schema below. No markdown fences, no commentary outside the JSON.
- Reference each flagged transaction by its "ref" id so the UI can map your explanation back.
- For each ref, set "severity" honestly: "high" for ≥3σ moves or large absolute hits, "medium" for ≥2.5σ, "low" otherwise.
- Explanations should be SPECIFIC: "EXPENSE in 玩乐金/Lifestyle of CNY 1,820 is 3.1× the 6-month average of CNY 590 — likely a one-off splurge."
- If none of the flags warrant follow-up, say so candidly. Do NOT invent root causes — the data does not include payees or notes.
- Recommendations are about WHAT TO DO with these flags ("review the 2026-05-04 EXPENSE …"), not generic budgeting advice.

Schema:
{
  "title": string,
  "summary": string,
  "anomalies": [{ "ref": string, "severity": "low" | "medium" | "high", "explanation": string }],
  "recommendations": [string],
  "flags": [{ "kind": "positive" | "warning" | "watch", "message": string }]
}`;

export function buildUserPrompt(metrics: InsightMetrics): string {
  return [
    "Aggregate metrics for the household:",
    "```json",
    JSON.stringify(metrics, null, 2),
    "```",
    "",
    "Task: produce the monthly summary insight per the system instructions.",
    "Focus on the current vs previous month delta, the savings-rate-vs-goal gap, the top expense categories, and the net-worth trajectory.",
  ].join("\n");
}

export function buildAnomalyUserPrompt(report: AnomalyReport): string {
  // Strip occurredOn Date objects → ISO yyyy-mm-dd so the prompt is JSON-safe
  // and the timestamp doesn't drift on serialization.
  const slim = {
    baseCurrency: report.baseCurrency,
    current: report.current,
    lookback: report.lookback,
    thresholds: report.thresholds,
    totalCandidates: report.totalCandidates,
    suppressedByCap: report.suppressedByCap,
    baselines: report.baselines.map((b) => ({
      categoryLabel: b.categoryLabel,
      kind: b.key.kind,
      meanMinor: Math.round(b.meanMinor),
      stddevMinor: Math.round(b.stddevMinor),
      sampleCount: b.count,
      sampleStart: b.sampleStart.toISOString().slice(0, 10),
      sampleEnd: b.sampleEnd.toISOString().slice(0, 10),
    })),
    anomalies: report.anomalies.map((a) => ({
      ref: a.ref,
      categoryLabel: a.categoryLabel,
      kind: a.kind,
      occurredOn: a.occurredOn.toISOString().slice(0, 10),
      amountMinor: a.amountMinor,
      zScore: Number(a.zScore.toFixed(3)),
      direction: a.direction,
      deviationMinor: Math.round(a.deviationMinor),
    })),
  };
  return [
    "Aggregate anomaly report for the household:",
    "```json",
    JSON.stringify(slim, null, 2),
    "```",
    "",
    "Task: explain each flagged transaction per the system instructions, then return the structured JSON. If `anomalies` is empty, return an empty `anomalies` array and a candid `summary` that says the month is clean.",
  ].join("\n");
}
