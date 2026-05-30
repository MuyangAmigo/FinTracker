import { audit } from "@/lib/auth/audit";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { prisma } from "@/lib/db";
import {
  buildInsightMetrics,
  type InsightMetrics,
} from "@/lib/ai/metrics";
import {
  buildAnomalyReport,
  type AnomalyReport,
  type AnomalyTxnRow,
} from "@/lib/ai/anomalies";
import { getFoundryClient } from "@/lib/ai/foundry";
import type {
  AnomalyResponse,
  InsightResponse,
} from "@/lib/ai/validate";
import {
  currentMonthRange,
  monthRange,
  previousMonthRange,
} from "@/lib/finance/period";
import type { AccountKind } from "@/lib/finance/net-worth";
import { LOOKBACK_MONTHS } from "@/lib/ai/anomalies";

/*
 * Orchestrator for Phase-7 monthly-summary generation.
 *
 *   1. Pull the data the metric builder needs (transactions for current +
 *      previous month, all snapshots, accounts, categories, household).
 *   2. Build the aggregate snapshot (pure).
 *   3. Create an InsightRun row in RUNNING.
 *   4. Call the Foundry client (mock or live).
 *   5. On success: persist the Insight row + mark RUNNING → SUCCEEDED.
 *      On failure: mark FAILED with the error message so the UI can
 *      surface what went wrong.
 *
 * The audit log records every generation as `insight`.
 */

export type GenerateOutcome =
  | { ok: true; insightId: string; runId: string; mock: boolean }
  | { ok: false; runId: string; error: string };

export interface GenerateOpts {
  actorEmail: string | null;
  now?: Date;
}

export async function generateMonthlySummary(
  opts: GenerateOpts,
): Promise<GenerateOutcome> {
  const now = opts.now ?? new Date();
  const current = currentMonthRange(now);
  const previous = previousMonthRange(current);

  const [household, txns, snapshots, accounts, categories] = await Promise.all([
    prisma.household.findUnique({
      where: { id: CURRENT_HOUSEHOLD_ID },
      select: { baseCurrency: true, savingsGoalRate: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: CURRENT_HOUSEHOLD_ID,
        occurredOn: { gte: previous.start, lt: current.nextStart },
      },
      select: {
        kind: true,
        amountMinor: true,
        currency: true,
        categoryId: true,
        personTag: true,
        occurredOn: true,
      },
    }),
    prisma.accountSnapshot.findMany({
      where: { householdId: CURRENT_HOUSEHOLD_ID },
      select: {
        accountId: true,
        asOf: true,
        balanceMinor: true,
        currency: true,
      },
    }),
    prisma.account.findMany({
      where: { householdId: CURRENT_HOUSEHOLD_ID, archivedAt: null },
      select: { id: true, kind: true },
    }),
    prisma.category.findMany({
      where: { householdId: CURRENT_HOUSEHOLD_ID },
      select: { id: true, name: true, nameZh: true },
    }),
  ]);

  const baseCurrency = household?.baseCurrency ?? "CNY";
  const savingsGoalRate = household?.savingsGoalRate
    ? Number(household.savingsGoalRate)
    : 0.6;

  const metrics: InsightMetrics = buildInsightMetrics({
    baseCurrency,
    savingsGoalRate,
    transactions: txns.map((t) => ({
      kind: t.kind,
      amountMinor: t.amountMinor,
      currency: t.currency,
      categoryId: t.categoryId,
      personTag: t.personTag,
      occurredOn: t.occurredOn,
    })),
    snapshots: snapshots.map((s) => ({
      accountId: s.accountId,
      asOf: s.asOf,
      balanceMinor: s.balanceMinor,
      currency: s.currency,
    })),
    accounts: accounts.map((a) => ({ id: a.id, kind: a.kind as AccountKind })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      nameZh: c.nameZh,
    })),
    now,
  });

  const client = getFoundryClient();

  const run = await prisma.insightRun.create({
    data: {
      householdId: CURRENT_HOUSEHOLD_ID,
      periodStart: current.start,
      periodEnd: current.end,
      modelDeployment: client.deployment,
      promptVersion: client.promptVersion,
      status: "RUNNING",
      inputSnapshot: metrics as never,
    },
  });

  try {
    const { response, mock, modelDeployment, promptVersion } =
      await client.summarize(metrics);
    const insight = await prisma.insight.create({
      data: {
        householdId: CURRENT_HOUSEHOLD_ID,
        insightRunId: run.id,
        kind: "SUMMARY",
        title: response.title,
        body: renderInsightMarkdown(response),
        payload: {
          ...response,
          modelDeployment,
          promptVersion,
          mock,
        } as never,
      },
    });
    await prisma.insightRun.update({
      where: { id: run.id },
      data: { status: "SUCCEEDED" },
    });
    audit({
      type: "insight",
      actor: opts.actorEmail,
      householdId: CURRENT_HOUSEHOLD_ID,
      resource: `insight:${insight.id}`,
      metadata: { runId: run.id, mock, modelDeployment, promptVersion },
    });
    return { ok: true, insightId: insight.id, runId: run.id, mock };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.insightRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 1000) },
    });
    return { ok: false, runId: run.id, error: message };
  }
}

/**
 * Render the structured insight response as Markdown for persistence in
 * `Insight.body`. We store both: structured (in `payload`) for the UI
 * to iterate, and rendered Markdown (in `body`) for read-only consumers
 * / future PDF export.
 */
export function renderInsightMarkdown(response: InsightResponse): string {
  const lines: string[] = [`# ${response.title}`, "", response.summary, ""];
  if (response.keyMetrics.length > 0) {
    lines.push("## Key metrics", "");
    for (const m of response.keyMetrics) {
      lines.push(`- **${m.label}** — ${m.value}`);
    }
    lines.push("");
  }
  if (response.flags.length > 0) {
    lines.push("## Flags", "");
    for (const f of response.flags) {
      lines.push(`- _${f.kind}_ — ${f.message}`);
    }
    lines.push("");
  }
  if (response.recommendations.length > 0) {
    lines.push("## Recommendations", "");
    for (const r of response.recommendations) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

export interface SubmitFeedbackArgs {
  insightId: string;
  /** -1, 0, or 1. */
  rating: number;
  note?: string | null;
  actorEmail: string | null;
}

export async function submitInsightFeedback(
  args: SubmitFeedbackArgs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rating = Math.max(-1, Math.min(1, Math.round(args.rating)));
  const insight = await prisma.insight.findFirst({
    where: { id: args.insightId, householdId: CURRENT_HOUSEHOLD_ID },
    select: { id: true },
  });
  if (!insight) return { ok: false, error: "Insight not found" };
  await prisma.insight.update({
    where: { id: insight.id },
    data: { feedback: rating, feedbackNote: args.note?.trim() || null },
  });
  audit({
    type: "insight",
    actor: args.actorEmail,
    householdId: CURRENT_HOUSEHOLD_ID,
    resource: `insight:${insight.id}`,
    metadata: { feedback: rating },
  });
  return { ok: true };
}

/*
 * Phase-7 carry-forward: anomaly orchestrator.
 *
 *   1. Pull the LOOKBACK_MONTHS + current month of transactions and the
 *      household's categories.
 *   2. Build the anomaly report (pure).
 *   3. Create an InsightRun (kind via the Insight row's `kind` enum; the
 *      run itself is generic).
 *   4. Call the Foundry client's `detectAnomalies` (mock or live).
 *   5. On success: persist `Insight (kind = ANOMALY)` + mark SUCCEEDED.
 *      On failure: mark FAILED with the error message.
 */

export type GenerateAnomalyOutcome =
  | {
      ok: true;
      insightId: string;
      runId: string;
      mock: boolean;
      anomalyCount: number;
    }
  | { ok: false; runId: string; error: string };

export async function generateAnomalyInsights(
  opts: GenerateOpts,
): Promise<GenerateAnomalyOutcome> {
  const now = opts.now ?? new Date();
  const current = currentMonthRange(now);
  // Lookback starts LOOKBACK_MONTHS calendar months before the current month.
  const lookbackStart = monthRange(
    current.start.getUTCFullYear(),
    current.start.getUTCMonth() - LOOKBACK_MONTHS,
  ).start;

  const [household, txns, categories] = await Promise.all([
    prisma.household.findUnique({
      where: { id: CURRENT_HOUSEHOLD_ID },
      select: { baseCurrency: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: CURRENT_HOUSEHOLD_ID,
        occurredOn: { gte: lookbackStart, lt: current.nextStart },
      },
      select: {
        id: true,
        kind: true,
        amountMinor: true,
        currency: true,
        categoryId: true,
        personTag: true,
        occurredOn: true,
      },
    }),
    prisma.category.findMany({
      where: { householdId: CURRENT_HOUSEHOLD_ID },
      select: { id: true, name: true, nameZh: true },
    }),
  ]);

  const baseCurrency = household?.baseCurrency ?? "CNY";

  const txnRows: AnomalyTxnRow[] = txns.map((t) => ({
    id: t.id,
    kind: t.kind,
    amountMinor: t.amountMinor,
    currency: t.currency,
    categoryId: t.categoryId,
    personTag: t.personTag,
    occurredOn: t.occurredOn,
  }));

  const report: AnomalyReport = buildAnomalyReport(
    {
      baseCurrency,
      transactions: txnRows,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        nameZh: c.nameZh,
      })),
    },
    { now },
  );

  const client = getFoundryClient();

  const run = await prisma.insightRun.create({
    data: {
      householdId: CURRENT_HOUSEHOLD_ID,
      periodStart: current.start,
      periodEnd: current.end,
      modelDeployment: client.deployment,
      promptVersion: client.anomalyPromptVersion,
      status: "RUNNING",
      inputSnapshot: serialiseReport(report) as never,
    },
  });

  try {
    const { response, mock, modelDeployment, promptVersion } =
      await client.detectAnomalies(report);
    // Verify every model-cited ref maps back to a real candidate. Drop any
    // hallucinated refs rather than fabricating UI cards.
    const validRefs = new Set(report.anomalies.map((a) => a.ref));
    const filteredAnomalies = response.anomalies.filter((a) =>
      validRefs.has(a.ref),
    );
    const safeResponse: AnomalyResponse = {
      ...response,
      anomalies: filteredAnomalies,
    };
    const insight = await prisma.insight.create({
      data: {
        householdId: CURRENT_HOUSEHOLD_ID,
        insightRunId: run.id,
        kind: "ANOMALY",
        title: response.title,
        body: renderAnomalyMarkdown(safeResponse, report),
        payload: {
          ...safeResponse,
          report: serialiseReport(report),
          modelDeployment,
          promptVersion,
          mock,
        } as never,
      },
    });
    await prisma.insightRun.update({
      where: { id: run.id },
      data: { status: "SUCCEEDED" },
    });
    audit({
      type: "insight",
      actor: opts.actorEmail,
      householdId: CURRENT_HOUSEHOLD_ID,
      resource: `insight:${insight.id}`,
      metadata: {
        runId: run.id,
        mock,
        modelDeployment,
        promptVersion,
        anomalyCount: filteredAnomalies.length,
        totalCandidates: report.totalCandidates,
      },
    });
    return {
      ok: true,
      insightId: insight.id,
      runId: run.id,
      mock,
      anomalyCount: filteredAnomalies.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.insightRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 1000) },
    });
    return { ok: false, runId: run.id, error: message };
  }
}

/**
 * Convert AnomalyReport to a JSON-safe shape for storage (Dates → ISO).
 * The Prisma `Json` column tolerates Date but Postgres serialises them
 * with the local timezone offset; ISO yyyy-mm-dd keeps them deterministic.
 */
function serialiseReport(report: AnomalyReport) {
  return {
    ...report,
    baselines: report.baselines.map((b) => ({
      ...b,
      sampleStart: b.sampleStart.toISOString().slice(0, 10),
      sampleEnd: b.sampleEnd.toISOString().slice(0, 10),
    })),
    anomalies: report.anomalies.map((a) => ({
      ...a,
      occurredOn: a.occurredOn.toISOString().slice(0, 10),
    })),
  };
}

export function renderAnomalyMarkdown(
  response: AnomalyResponse,
  report: AnomalyReport,
): string {
  const lines: string[] = [`# ${response.title}`, "", response.summary, ""];
  if (response.anomalies.length > 0) {
    lines.push("## Flagged transactions", "");
    const reportById = new Map(report.anomalies.map((a) => [a.ref, a]));
    for (const a of response.anomalies) {
      const meta = reportById.get(a.ref);
      const head = meta
        ? `**${meta.categoryLabel}** · ${meta.kind} · ${meta.occurredOn
            .toISOString()
            .slice(0, 10)} · z=${meta.zScore.toFixed(2)}`
        : `**${a.ref}**`;
      lines.push(`- ${head} — _${a.severity}_ — ${a.explanation}`);
    }
    lines.push("");
  }
  if (response.flags.length > 0) {
    lines.push("## Flags", "");
    for (const f of response.flags) {
      lines.push(`- _${f.kind}_ — ${f.message}`);
    }
    lines.push("");
  }
  if (response.recommendations.length > 0) {
    lines.push("## Recommendations", "");
    for (const r of response.recommendations) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}
