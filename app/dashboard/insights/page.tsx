import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PillTag } from "@/components/ui/pill-tag";
import { GenerateInsightButton } from "@/components/finance/generate-insight-button";
import { InsightFeedback } from "@/components/finance/insight-feedback";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { readFoundryConfig } from "@/lib/ai/foundry";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import {
  insightResponseSchema,
  type InsightResponse,
} from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

/*
 * Phase-7 Insights page.
 *
 * Lists generated insights for the household (newest first) with a
 * "Generate monthly summary" CTA. When Foundry env vars are unset we
 * surface a "running in mock mode" notice so it's obvious the cards are
 * deterministic stand-ins rather than live model output.
 */
export default async function InsightsPage() {
  await requireSession();

  const [insights, recentRuns] = await Promise.all([
    prisma.insight.findMany({
      where: { householdId: CURRENT_HOUSEHOLD_ID },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        insightRun: {
          select: {
            modelDeployment: true,
            promptVersion: true,
            periodStart: true,
            periodEnd: true,
          },
        },
      },
    }),
    prisma.insightRun.findMany({
      where: { householdId: CURRENT_HOUSEHOLD_ID, status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        createdAt: true,
        modelDeployment: true,
        errorMessage: true,
      },
    }),
  ]);

  const cfg = readFoundryConfig();
  const mode = cfg ? "live" : "mock";

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <PillTag>AI Insights · Phase 7</PillTag>
            <h1 className="font-display-md mt-3 text-on-primary">
              Household summaries
            </h1>
            <p className="font-body-md mt-1 text-on-primary/70">
              Foundry-generated monthly summaries grounded in your transactions
              and snapshots. Aggregates only — no raw rows ever leave the
              database.
            </p>
          </div>
          <GenerateInsightButton />
        </header>

        <ModeNotice mode={mode} promptVersion={PROMPT_VERSION} />

        {recentRuns.length > 0 ? (
          <Card
            variant="dashboardMockup"
            padding="md"
            className="mb-6 border border-ruby/40 bg-brand-dark-900/60 text-on-primary"
          >
            <p className="font-micro-cap text-ruby">Recent failed runs</p>
            <ul className="font-body-sm mt-2 space-y-1 text-on-primary/80">
              {recentRuns.map((r) => (
                <li key={r.id}>
                  <span className="text-on-primary/60">
                    {r.createdAt.toISOString().slice(0, 19).replace("T", " ")} ·{" "}
                    {r.modelDeployment}
                  </span>{" "}
                  — {r.errorMessage ?? "(no message)"}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {insights.length === 0 ? (
          <Card
            variant="dashboardMockup"
            padding="lg"
            className="bg-brand-dark-900/60 text-on-primary"
          >
            <p className="font-body-md text-on-primary/80">
              No insights yet — hit{" "}
              <span className="font-button-md">Generate monthly summary</span>{" "}
              to create one for the current month.
            </p>
          </Card>
        ) : (
          <ul className="space-y-6">
            {insights.map((insight) => {
              const payload = parsePayload(insight.payload);
              return (
                <li key={insight.id}>
                  <InsightCard
                    title={insight.title}
                    body={insight.body}
                    payload={payload}
                    createdAt={insight.createdAt}
                    modelDeployment={
                      insight.insightRun?.modelDeployment ?? "unknown"
                    }
                    promptVersion={
                      insight.insightRun?.promptVersion ?? "unknown"
                    }
                  />
                  <InsightFeedback
                    insightId={insight.id}
                    initialRating={insight.feedback ?? 0}
                    initialNote={insight.feedbackNote}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <p className="font-micro mt-10 text-on-primary/50">
          Carry-forward (tracked in plan.md): anomaly flags, conversational
          ask, PDF export.
        </p>
        <p className="font-micro mt-1 text-on-primary/50">
          Health probe:{" "}
          <Link
            href="/api/health/foundry"
            className="text-primary-soft hover:underline"
          >
            /api/health/foundry
          </Link>
        </p>
      </div>
    </main>
  );
}

function InsightCard({
  title,
  body,
  payload,
  createdAt,
  modelDeployment,
  promptVersion,
}: {
  title: string;
  body: string;
  payload: (InsightResponse & { mock?: boolean }) | null;
  createdAt: Date;
  modelDeployment: string;
  promptVersion: string;
}) {
  return (
    <Card
      variant="dashboardMockup"
      padding="lg"
      className="bg-brand-dark-900/60 text-on-primary"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display-sm text-on-primary">{title}</h2>
          <p className="font-micro mt-1 text-on-primary/50">
            {createdAt.toISOString().slice(0, 10)} · {modelDeployment} ·{" "}
            {promptVersion}
            {payload?.mock ? " · mock" : ""}
          </p>
        </div>
      </div>

      {payload ? (
        <StructuredInsight payload={payload} />
      ) : (
        <pre className="font-body-md mt-4 whitespace-pre-wrap text-on-primary/80">
          {body}
        </pre>
      )}
    </Card>
  );
}

function StructuredInsight({
  payload,
}: {
  payload: InsightResponse & { mock?: boolean };
}) {
  return (
    <>
      <p className="font-body-md mt-4 text-on-primary/85 whitespace-pre-line">
        {payload.summary}
      </p>

      {payload.keyMetrics.length > 0 ? (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {payload.keyMetrics.map((m, i) => (
            <div
              key={`${m.label}-${i}`}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
            >
              <dt className="font-micro-cap text-on-primary/60">{m.label}</dt>
              <dd className="font-body-tabular tabular-money text-on-primary">
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {payload.flags.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {payload.flags.map((f, i) => (
            <li
              key={`${f.kind}-${i}`}
              className="font-body-md flex items-start gap-3 text-on-primary/85"
            >
              <FlagBadge kind={f.kind} />
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {payload.recommendations.length > 0 ? (
        <div className="mt-5">
          <p className="font-micro-cap text-on-primary/60">Recommendations</p>
          <ul className="font-body-md mt-2 list-disc space-y-1 pl-5 text-on-primary/85">
            {payload.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function FlagBadge({ kind }: { kind: "positive" | "warning" | "watch" }) {
  const klass =
    kind === "positive"
      ? "border-primary text-primary-soft"
      : kind === "warning"
        ? "border-ruby text-ruby"
        : "border-white/30 text-on-primary/70";
  const label =
    kind === "positive" ? "Positive" : kind === "warning" ? "Warning" : "Watch";
  return (
    <span
      className={`mt-0.5 inline-block min-w-[4.5rem] rounded-pill border px-2 py-0.5 text-center font-micro-cap ${klass}`}
    >
      {label}
    </span>
  );
}

function ModeNotice({
  mode,
  promptVersion,
}: {
  mode: "live" | "mock";
  promptVersion: string;
}) {
  if (mode === "live") {
    return (
      <p className="font-body-sm mb-6 text-on-primary/60">
        Running against Microsoft Foundry · prompt <code>{promptVersion}</code>.
      </p>
    );
  }
  return (
    <Card
      variant="dashboardMockup"
      padding="md"
      className="mb-6 border border-white/15 bg-brand-dark-900/60 text-on-primary"
    >
      <p className="font-micro-cap text-on-primary/60">Mock mode</p>
      <p className="font-body-sm mt-2 text-on-primary/80">
        <code>FOUNDRY_ENDPOINT</code>, <code>FOUNDRY_DEPLOYMENT</code>, and{" "}
        <code>FOUNDRY_API_KEY</code> are not all set. Generated insights are
        produced from a deterministic local template so the UI is still
        exercisable. Set those env vars to switch to live Microsoft Foundry
        output. Prompt version: <code>{promptVersion}</code>.
      </p>
    </Card>
  );
}

function parsePayload(
  value: unknown,
): (InsightResponse & { mock?: boolean }) | null {
  if (!value || typeof value !== "object") return null;
  try {
    const parsed = insightResponseSchema.parse(value);
    const mock =
      typeof (value as { mock?: unknown }).mock === "boolean"
        ? ((value as { mock: boolean }).mock as boolean)
        : false;
    return { ...parsed, mock };
  } catch {
    return null;
  }
}
