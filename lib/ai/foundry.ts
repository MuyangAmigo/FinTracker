import {
  anomalyResponseSchema,
  insightResponseSchema,
  type AnomalyResponse,
  type InsightResponse,
} from "@/lib/ai/validate";
import {
  ANOMALY_PROMPT_VERSION,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  ANOMALY_SYSTEM_PROMPT,
  buildAnomalyUserPrompt,
  buildUserPrompt,
} from "@/lib/ai/prompts";
import type { InsightMetrics } from "@/lib/ai/metrics";
import type { AnomalyReport } from "@/lib/ai/anomalies";
import { formatMoney } from "@/lib/money";

/*
 * Microsoft Foundry / Azure OpenAI client wrapper.
 *
 * Hits the chat-completions REST endpoint directly with `fetch` so we
 * don't pull in the OpenAI SDK. Auth is API-key based for Phase 7;
 * Managed Identity will follow in Phase 8b alongside Key Vault.
 *
 * When `FOUNDRY_ENDPOINT` / `FOUNDRY_DEPLOYMENT` / `FOUNDRY_API_KEY` are
 * unset, the client runs in MOCK mode: it deterministically constructs
 * structured insights (monthly summary or anomaly explanations) from the
 * input metrics so the full stack (UI, audit, Prisma persistence) is
 * exercisable without any Azure resource. The returned `mock: true` flag
 * lets the UI surface this clearly.
 */

const DEFAULT_API_VERSION = "2024-08-01-preview";
const DEFAULT_TIMEOUT_MS = 30_000;

export interface FoundryConfig {
  endpoint: string;
  deployment: string;
  apiKey: string;
  apiVersion: string;
  timeoutMs: number;
}

export interface FoundryClient {
  readonly mode: "live" | "mock";
  readonly deployment: string;
  readonly promptVersion: string;
  readonly anomalyPromptVersion: string;
  summarize(metrics: InsightMetrics): Promise<FoundryResult>;
  detectAnomalies(report: AnomalyReport): Promise<FoundryAnomalyResult>;
}

export interface FoundryResult {
  response: InsightResponse;
  raw: string;
  mock: boolean;
  modelDeployment: string;
  promptVersion: string;
}

export interface FoundryAnomalyResult {
  response: AnomalyResponse;
  raw: string;
  mock: boolean;
  modelDeployment: string;
  promptVersion: string;
}

export function readFoundryConfig(): FoundryConfig | null {
  const endpoint = process.env.FOUNDRY_ENDPOINT?.replace(/\/+$/, "");
  const deployment = process.env.FOUNDRY_DEPLOYMENT;
  const apiKey = process.env.FOUNDRY_API_KEY;
  if (!endpoint || !deployment || !apiKey) return null;
  return {
    endpoint,
    deployment,
    apiKey,
    apiVersion: process.env.FOUNDRY_API_VERSION ?? DEFAULT_API_VERSION,
    timeoutMs: Number(process.env.FOUNDRY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };
}

export function getFoundryClient(): FoundryClient {
  const cfg = readFoundryConfig();
  return cfg ? createLiveClient(cfg) : createMockClient();
}

async function postChatCompletion(
  cfg: FoundryConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
  const body = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: maxTokens,
  };
  const url = `${cfg.endpoint}/openai/deployments/${cfg.deployment}/chat/completions?api-version=${cfg.apiVersion}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": cfg.apiKey,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Foundry chat-completions failed: ${res.status} ${res.statusText}: ${text.slice(0, 500)}`,
    );
  }
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Foundry response missing choices[0].message.content");
  }
  return content;
}

function createLiveClient(cfg: FoundryConfig): FoundryClient {
  return {
    mode: "live",
    deployment: cfg.deployment,
    promptVersion: PROMPT_VERSION,
    anomalyPromptVersion: ANOMALY_PROMPT_VERSION,
    async summarize(metrics) {
      const content = await postChatCompletion(
        cfg,
        SYSTEM_PROMPT,
        buildUserPrompt(metrics),
        1200,
      );
      const response = insightResponseSchema.parse(JSON.parse(content));
      return {
        response,
        raw: content,
        mock: false,
        modelDeployment: cfg.deployment,
        promptVersion: PROMPT_VERSION,
      };
    },
    async detectAnomalies(report) {
      const content = await postChatCompletion(
        cfg,
        ANOMALY_SYSTEM_PROMPT,
        buildAnomalyUserPrompt(report),
        1500,
      );
      const response = anomalyResponseSchema.parse(JSON.parse(content));
      return {
        response,
        raw: content,
        mock: false,
        modelDeployment: cfg.deployment,
        promptVersion: ANOMALY_PROMPT_VERSION,
      };
    },
  };
}

function createMockClient(): FoundryClient {
  return {
    mode: "mock",
    deployment: "mock-deployment",
    promptVersion: PROMPT_VERSION,
    anomalyPromptVersion: ANOMALY_PROMPT_VERSION,
    async summarize(metrics) {
      const response = buildMockResponse(metrics);
      return {
        response,
        raw: JSON.stringify(response),
        mock: true,
        modelDeployment: "mock-deployment",
        promptVersion: PROMPT_VERSION,
      };
    },
    async detectAnomalies(report) {
      const response = buildMockAnomalyResponse(report);
      return {
        response,
        raw: JSON.stringify(response),
        mock: true,
        modelDeployment: "mock-deployment",
        promptVersion: ANOMALY_PROMPT_VERSION,
      };
    },
  };
}

/**
 * Deterministic mock so dev/test environments can exercise the full
 * stack without any external API. Mirrors what a real model would say
 * at a high level — MoM delta, savings rate vs goal, top category,
 * net-worth trajectory.
 */
export function buildMockResponse(metrics: InsightMetrics): InsightResponse {
  const { current, previous, monthOverMonth, netWorth, topCategories } =
    metrics;
  const fmt = (minor: number) =>
    formatMoney(
      { amountMinor: Math.abs(minor), currency: metrics.baseCurrency },
      { signed: false },
    );
  const sign = (n: number) => (n >= 0 ? "+" : "-");

  const rateText =
    current.savingsRate !== null
      ? `${(current.savingsRate * 100).toFixed(1)}%`
      : "n/a";
  const goalText = `${Math.round(metrics.savingsGoalRate * 100)}%`;
  const onTrack =
    current.savingsRate !== null &&
    current.savingsRate >= metrics.savingsGoalRate;

  const summary = [
    `${current.monthLabel}: income ${fmt(current.income.amountMinor)}, expense ${fmt(
      current.expense.amountMinor,
    )}, savings ${fmt(current.savings.amountMinor)} (${rateText}).`,
    `vs ${previous.monthLabel}: income ${sign(monthOverMonth.incomeDeltaMinor)}${fmt(monthOverMonth.incomeDeltaMinor)}, expense ${sign(monthOverMonth.expenseDeltaMinor)}${fmt(monthOverMonth.expenseDeltaMinor)}.`,
    netWorth.deltaMinor !== null
      ? `Net worth moved ${sign(netWorth.deltaMinor)}${fmt(netWorth.deltaMinor)} over the period.`
      : "Net-worth delta unavailable — log a snapshot to enable it.",
  ].join(" ");

  const flags: InsightResponse["flags"] = [];
  flags.push(
    onTrack
      ? {
          kind: "positive",
          message: `Savings rate ${rateText} clears the ${goalText} household goal.`,
        }
      : current.savingsRate !== null
        ? {
            kind: "warning",
            message: `Savings rate ${rateText} is below the ${goalText} goal.`,
          }
        : {
            kind: "watch",
            message: "No income recorded yet — savings rate unavailable.",
          },
  );
  if (monthOverMonth.expenseDeltaMinor > 0) {
    flags.push({
      kind: "watch",
      message: `Expenses up ${fmt(monthOverMonth.expenseDeltaMinor)} vs last month.`,
    });
  }

  const recommendations: string[] = [];
  if (!onTrack && topCategories.length > 0) {
    const top = topCategories[0];
    recommendations.push(
      `Review ${top.label} (${(top.share * 100).toFixed(0)}% of expense, ${fmt(top.amountMinor)}) for trims that move the savings rate toward ${goalText}.`,
    );
  }
  if (netWorth.deltaMinor !== null && netWorth.deltaMinor < 0) {
    recommendations.push(
      "Net worth dipped — confirm any large outflows reconcile with logged transactions or snapshots.",
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      `Hold the line — ${current.monthLabel} is tracking healthily vs ${previous.monthLabel}.`,
    );
  }

  const keyMetrics: InsightResponse["keyMetrics"] = [
    { label: "Income", value: fmt(current.income.amountMinor) },
    { label: "Expense", value: fmt(current.expense.amountMinor) },
    { label: "Savings", value: fmt(current.savings.amountMinor) },
    { label: "Savings rate", value: rateText },
  ];
  if (netWorth.currentMinor !== null) {
    keyMetrics.push({
      label: "Net worth",
      value: fmt(netWorth.currentMinor),
    });
  }

  return {
    title: `${current.monthLabel} household summary`,
    summary,
    keyMetrics,
    recommendations,
    flags,
  };
}

/**
 * Deterministic mock anomaly response. Per-anomaly templated explanation
 * with severity derived from |z-score| so dev/test environments exercise
 * the full anomaly surface without any external API.
 */
export function buildMockAnomalyResponse(
  report: AnomalyReport,
): AnomalyResponse {
  const fmt = (minor: number) =>
    formatMoney(
      { amountMinor: Math.abs(minor), currency: report.baseCurrency },
      { signed: false },
    );

  if (report.anomalies.length === 0) {
    return {
      title: `${report.current.monthKey} anomaly scan`,
      summary: `No transactions exceeded the ${report.thresholds.zThreshold}σ + ${fmt(
        report.thresholds.minAbsDeviationMinor,
      )} thresholds for ${report.current.monthKey}. Either it's a quiet month or there isn't enough history yet (need ≥${report.thresholds.minSampleSize} samples per category).`,
      anomalies: [],
      recommendations: [
        `Keep logging — once each category has ≥${report.thresholds.minSampleSize} months of history, the detector covers it automatically.`,
      ],
      flags: [
        { kind: "positive", message: "No outliers flagged for this month." },
      ],
    };
  }

  const anomalies: AnomalyResponse["anomalies"] = report.anomalies.map((a) => {
    const abs = Math.abs(a.zScore);
    const severity: "low" | "medium" | "high" =
      abs >= 3 ? "high" : abs >= 2.5 ? "medium" : "low";
    const ratio =
      a.baseline.meanMinor === 0
        ? "n/a"
        : `${(a.amountMinor / a.baseline.meanMinor).toFixed(2)}×`;
    const explanation = `${a.kind} in ${a.categoryLabel} of ${fmt(a.amountMinor)} on ${a.occurredOn
      .toISOString()
      .slice(0, 10)} sits ${a.zScore.toFixed(2)}σ ${a.direction} the ${fmt(
      a.baseline.meanMinor,
    )} ${report.lookback.months}-month average (${ratio} the mean, sample n=${a.baseline.sampleCount}).`;
    return { ref: a.ref, severity, explanation };
  });

  const highCount = anomalies.filter((a) => a.severity === "high").length;
  const recommendations: string[] = [];
  if (highCount > 0) {
    recommendations.push(
      `Review the ${highCount} high-severity flag${highCount > 1 ? "s" : ""} first — they're the largest outliers and most likely to be one-off charges or mis-categorisations.`,
    );
  }
  recommendations.push(
    "If a flag is a known one-off (e.g. annual subscription, gift), note it as feedback so future scans can keep the same baseline.",
  );
  if (report.suppressedByCap > 0) {
    recommendations.push(
      `${report.suppressedByCap} additional candidate${report.suppressedByCap > 1 ? "s" : ""} were suppressed by the top-${report.anomalies.length} cap — adjust the cap if you want to see more.`,
    );
  }

  const flags: AnomalyResponse["flags"] = [];
  if (highCount > 0) {
    flags.push({
      kind: "warning",
      message: `${highCount} high-severity outlier${highCount > 1 ? "s" : ""} detected for ${report.current.monthKey}.`,
    });
  } else {
    flags.push({
      kind: "watch",
      message: `${anomalies.length} flag${anomalies.length > 1 ? "s" : ""} above the baseline thresholds.`,
    });
  }

  return {
    title: `${report.current.monthKey} anomaly scan`,
    summary: `Flagged ${anomalies.length} transaction${anomalies.length > 1 ? "s" : ""} from ${report.totalCandidates} candidate${report.totalCandidates > 1 ? "s" : ""}. Thresholds: ${report.thresholds.zThreshold}σ and ≥${fmt(report.thresholds.minAbsDeviationMinor)} deviation, lookback ${report.lookback.months} months (${report.lookback.start} → ${report.lookback.end}).`,
    anomalies,
    recommendations,
    flags,
  };
}
