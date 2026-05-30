import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PillTag } from "@/components/ui/pill-tag";
import { DetectAnomaliesButton } from "@/components/finance/detect-anomalies-button";
import { GenerateInsightButton } from "@/components/finance/generate-insight-button";
import { InsightFeedback } from "@/components/finance/insight-feedback";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { readFoundryConfig } from "@/lib/ai/foundry";
import { ANOMALY_PROMPT_VERSION, PROMPT_VERSION } from "@/lib/ai/prompts";
import {
  anomalyResponseSchema,
  insightResponseSchema,
  type AnomalyResponse,
  type InsightResponse,
} from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

/*
 * Phase-7 Insights page.
 *
 * Lists generated insights for the household (newest first) with two CTAs:
 *   - "Generate monthly summary" (kind = SUMMARY).
 *   - "Detect anomalies" (kind = ANOMALY) — rolling-σ baseline scan of
 *     the current month, explained per-flag.
 *
 * When Foundry env vars are unset we surface a "running in mock mode"
 * notice so it's obvious the cards are deterministic stand-ins rather
 * than live model output.
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
              Household summaries &amp; anomaly flags
            </h1>
            <p className="font-body-md mt-1 text-on-primary/70">
              Foundry-generated monthly summaries and rolling-σ anomaly
              explanations, grounded in your transactions and snapshots.
              Aggregates only — no raw rows ever leave the database.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <DetectAnomaliesButton />
            <GenerateInsightButton />
          </div>
        </header>

        <ModeNotice
          mode={mode}
          promptVersion={PROMPT_VERSION}
          anomalyPromptVersion={ANOMALY_PROMPT_VERSION}
        />

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
              or <span className="font-button-md">Detect anomalies</span> to
              create one for the current month.
            </p>
          </Card>
        ) : (
          <ul className="space-y-6">
            {insights.map((insight) => {
              const kind = insight.kind;
              return (
                <li key={insight.id}>
                  {kind === "ANOMALY" ? (
                    <AnomalyInsightCard
                      title={insight.title}
                      body={insight.body}
                      payload={parseAnomalyPayload(insight.payload)}
                      createdAt={insight.createdAt}
                      modelDeployment={
                        insight.insightRun?.modelDeployment ?? "unknown"
                      }
                      promptVersion={
                        insight.insightRun?.promptVersion ?? "unknown"
                      }
                    />
                  ) : (
                    <InsightCard
                      title={insight.title}
                      body={insight.body}
                      payload={parsePayload(insight.payload)}
                      createdAt={insight.createdAt}
                      modelDeployment={
                        insight.insightRun?.modelDeployment ?? "unknown"
                      }
                      promptVersion={
                        insight.insightRun?.promptVersion ?? "unknown"
                      }
                    />
                  )}
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
          Carry-forward (tracked in plan.md): conversational ask, PDF export.
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
      <CardHeader
        title={title}
        createdAt={createdAt}
        modelDeployment={modelDeployment}
        promptVersion={promptVersion}
        kindLabel="Summary"
        kindClassName="border-primary text-primary-soft"
        mock={payload?.mock ?? false}
      />

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

function AnomalyInsightCard({
  title,
  body,
  payload,
  createdAt,
  modelDeployment,
  promptVersion,
}: {
  title: string;
  body: string;
  payload:
    | (AnomalyResponse & {
        mock?: boolean;
        report?: SerialisedReport | null;
      })
    | null;
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
      <CardHeader
        title={title}
        createdAt={createdAt}
        modelDeployment={modelDeployment}
        promptVersion={promptVersion}
        kindLabel="Anomalies"
        kindClassName="border-amber-300/60 text-amber-200"
        mock={payload?.mock ?? false}
      />

      {payload ? (
        <StructuredAnomaly payload={payload} />
      ) : (
        <pre className="font-body-md mt-4 whitespace-pre-wrap text-on-primary/80">
          {body}
        </pre>
      )}
    </Card>
  );
}

function CardHeader({
  title,
  createdAt,
  modelDeployment,
  promptVersion,
  kindLabel,
  kindClassName,
  mock,
}: {
  title: string;
  createdAt: Date;
  modelDeployment: string;
  promptVersion: string;
  kindLabel: string;
  kindClassName: string;
  mock: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <span
          className={`mb-2 inline-block rounded-pill border px-2 py-0.5 font-micro-cap ${kindClassName}`}
        >
          {kindLabel}
        </span>
        <h2 className="font-display-sm text-on-primary">{title}</h2>
        <p className="font-micro mt-1 text-on-primary/50">
          {createdAt.toISOString().slice(0, 10)} · {modelDeployment} ·{" "}
          {promptVersion}
          {mock ? " · mock" : ""}
        </p>
      </div>
    </div>
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

interface SerialisedReportAnomaly {
  ref: string;
  txnId: string;
  categoryLabel: string;
  kind: string;
  occurredOn: string;
  amountMinor: number;
  zScore: number;
  direction: "above" | "below";
  baseline: {
    meanMinor: number;
    stddevMinor: number;
    sampleCount: number;
  };
}

interface SerialisedReport {
  baseCurrency: string;
  current: { monthKey: string };
  lookback: { months: number };
  totalCandidates: number;
  suppressedByCap: number;
  anomalies: SerialisedReportAnomaly[];
}

function StructuredAnomaly({
  payload,
}: {
  payload: AnomalyResponse & {
    mock?: boolean;
    report?: SerialisedReport | null;
  };
}) {
  const report = payload.report ?? null;
  const reportById = new Map<string, SerialisedReportAnomaly>();
  if (report) {
    for (const a of report.anomalies) reportById.set(a.ref, a);
  }
  const baseCurrency = report?.baseCurrency ?? "CNY";

  return (
    <>
      <p className="font-body-md mt-4 text-on-primary/85 whitespace-pre-line">
        {payload.summary}
      </p>

      {payload.anomalies.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {payload.anomalies.map((a) => {
            const meta = reportById.get(a.ref) ?? null;
            return (
              <li
                key={a.ref}
                className="rounded-md border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-button-md text-on-primary">
                    {meta?.categoryLabel ?? a.ref} · {meta?.kind ?? "?"}
                  </p>
                  <SeverityBadge severity={a.severity} />
                </div>
                {meta ? (
                  <p className="font-micro mt-1 text-on-primary/55">
                    {meta.occurredOn} ·{" "}
                    <span className="tabular-money">
                      {formatMajor(meta.amountMinor, baseCurrency)}
                    </span>{" "}
                    · z={meta.zScore.toFixed(2)} {meta.direction} mean{" "}
                    {formatMajor(meta.baseline.meanMinor, baseCurrency)} (σ{" "}
                    {formatMajor(meta.baseline.stddevMinor, baseCurrency)}, n=
                    {meta.baseline.sampleCount})
                  </p>
                ) : null}
                <p className="font-body-md mt-2 text-on-primary/85">
                  {a.explanation}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="font-body-sm mt-4 text-on-primary/70">
          No flagged transactions for this scan.
        </p>
      )}

      {report && report.suppressedByCap > 0 ? (
        <p className="font-micro mt-4 text-on-primary/50">
          {report.suppressedByCap} additional candidate
          {report.suppressedByCap > 1 ? "s" : ""} suppressed by the top-
          {payload.anomalies.length} cap.
        </p>
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

function SeverityBadge({ severity }: { severity: "low" | "medium" | "high" }) {
  const klass =
    severity === "high"
      ? "border-ruby text-ruby"
      : severity === "medium"
        ? "border-amber-300/60 text-amber-200"
        : "border-white/30 text-on-primary/70";
  return (
    <span
      className={`inline-block min-w-[4.5rem] rounded-pill border px-2 py-0.5 text-center font-micro-cap ${klass}`}
    >
      {severity}
    </span>
  );
}

function ModeNotice({
  mode,
  promptVersion,
  anomalyPromptVersion,
}: {
  mode: "live" | "mock";
  promptVersion: string;
  anomalyPromptVersion: string;
}) {
  if (mode === "live") {
    return (
      <p className="font-body-sm mb-6 text-on-primary/60">
        Running against Microsoft Foundry · summary prompt{" "}
        <code>{promptVersion}</code> · anomaly prompt{" "}
        <code>{anomalyPromptVersion}</code>.
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
        produced from deterministic local templates so the UI is still
        exercisable. Set those env vars to switch to live Microsoft Foundry
        output. Prompt versions: <code>{promptVersion}</code> /{" "}
        <code>{anomalyPromptVersion}</code>.
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

function parseAnomalyPayload(
  value: unknown,
):
  | (AnomalyResponse & { mock?: boolean; report?: SerialisedReport | null })
  | null {
  if (!value || typeof value !== "object") return null;
  try {
    const parsed = anomalyResponseSchema.parse(value);
    const mock =
      typeof (value as { mock?: unknown }).mock === "boolean"
        ? ((value as { mock: boolean }).mock as boolean)
        : false;
    const reportRaw = (value as { report?: unknown }).report;
    const report = reportRaw && typeof reportRaw === "object"
      ? (reportRaw as SerialisedReport)
      : null;
    return { ...parsed, mock, report };
  } catch {
    return null;
  }
}

function formatMajor(amountMinor: number, currency: string): string {
  const abs = Math.abs(amountMinor) / 100;
  const sign = amountMinor < 0 ? "-" : "";
  return `${sign}${currency} ${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
