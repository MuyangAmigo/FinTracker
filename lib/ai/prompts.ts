import type { InsightMetrics } from "@/lib/ai/metrics";

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
