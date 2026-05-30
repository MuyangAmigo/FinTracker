import {
  insightResponseSchema,
  type InsightResponse,
} from "@/lib/ai/validate";
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
} from "@/lib/ai/prompts";
import type { InsightMetrics } from "@/lib/ai/metrics";
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
 * a structured insight from the input metrics so the full stack (UI,
 * audit, Prisma persistence) is exercisable without any Azure resource.
 * The returned `mock: true` flag lets the UI surface this clearly.
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
  summarize(metrics: InsightMetrics): Promise<FoundryResult>;
}

export interface FoundryResult {
  response: InsightResponse;
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

function createLiveClient(cfg: FoundryConfig): FoundryClient {
  return {
    mode: "live",
    deployment: cfg.deployment,
    promptVersion: PROMPT_VERSION,
    async summarize(metrics) {
      const body = {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(metrics) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1200,
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
      const parsed = JSON.parse(content);
      const response = insightResponseSchema.parse(parsed);
      return {
        response,
        raw: content,
        mock: false,
        modelDeployment: cfg.deployment,
        promptVersion: PROMPT_VERSION,
      };
    },
  };
}

function createMockClient(): FoundryClient {
  return {
    mode: "mock",
    deployment: "mock-deployment",
    promptVersion: PROMPT_VERSION,
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
