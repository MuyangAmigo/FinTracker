import { audit } from "@/lib/auth/audit";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { prisma } from "@/lib/db";
import {
  buildInsightMetrics,
  type InsightMetrics,
} from "@/lib/ai/metrics";
import { getFoundryClient } from "@/lib/ai/foundry";
import type { InsightResponse } from "@/lib/ai/validate";
import {
  currentMonthRange,
  previousMonthRange,
} from "@/lib/finance/period";
import type { AccountKind } from "@/lib/finance/net-worth";

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
