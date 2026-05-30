/*
 * Phase-7 carry-forward: rolling-σ anomaly detector.
 *
 * Pure functions: given a slice of historical transactions + a target
 * window, build per-(categoryId, kind) baselines (mean + sample stddev
 * over the last N months) and select current-window transactions that
 * deviate enough to be worth surfacing.
 *
 * The output is intentionally aggregate-only: category names, baseline
 * stats, and per-anomaly summaries (occurredOn, amount, kind, z-score).
 * No payees, no notes, no transaction descriptions ever ride along — the
 * Phase-7 privacy rule from DESIGN.md is preserved.
 */

import type {
  TransactionKind,
  TxnRow,
} from "@/lib/finance/aggregates";
import {
  currentMonthRange,
  monthRange,
  type MonthRange,
} from "@/lib/finance/period";

export const LOOKBACK_MONTHS = 6;
export const MIN_SAMPLE_SIZE = 5;
export const Z_THRESHOLD = 2.0;
/** Floor on |amount − mean| so we don't flag tiny noise in cheap categories. */
export const MIN_ABS_DEVIATION_MINOR = 5_000;
export const TOP_N_ANOMALIES = 10;

const UNCATEGORISED_KEY = "__uncategorised__";

export interface AnomalyTxnRow extends TxnRow {
  /** Stable id for the source transaction. Used so the model can cite it. */
  id: string;
  occurredOn: Date;
}

export interface CategoryLookup {
  id: string;
  name: string;
  nameZh?: string | null;
}

export interface BaselineKey {
  categoryId: string | null;
  kind: TransactionKind;
}

export interface CategoryBaseline {
  key: BaselineKey;
  categoryLabel: string;
  count: number;
  meanMinor: number;
  /** Sample stddev (n-1 divisor). 0 when count < 2. */
  stddevMinor: number;
  sampleStart: Date;
  sampleEnd: Date;
}

export interface AnomalyCandidate {
  ref: string;
  txnId: string;
  categoryId: string | null;
  categoryLabel: string;
  kind: TransactionKind;
  occurredOn: Date;
  amountMinor: number;
  /** Signed: positive = above mean, negative = below. */
  zScore: number;
  direction: "above" | "below";
  deviationMinor: number;
  baseline: {
    meanMinor: number;
    stddevMinor: number;
    sampleCount: number;
  };
}

export interface BaselineOpts {
  /** Now anchor. Defaults to `new Date()`. */
  now?: Date;
  /** Override `LOOKBACK_MONTHS` for testing. */
  lookbackMonths?: number;
  /** Override `MIN_SAMPLE_SIZE` for testing. */
  minSampleSize?: number;
}

export interface DetectOpts {
  /** Now anchor. Defaults to `new Date()`. */
  now?: Date;
  /** Override `Z_THRESHOLD` for testing. */
  zThreshold?: number;
  /** Override `MIN_ABS_DEVIATION_MINOR` for testing. */
  minAbsDeviationMinor?: number;
  /** Override `TOP_N_ANOMALIES` for testing. */
  topN?: number;
}

export interface AnomalyReport {
  generatedAt: string;
  baseCurrency: string;
  current: { monthKey: string; start: string; end: string };
  lookback: { months: number; start: string; end: string };
  thresholds: {
    zThreshold: number;
    minAbsDeviationMinor: number;
    minSampleSize: number;
  };
  baselines: CategoryBaseline[];
  anomalies: AnomalyCandidate[];
  /** Total candidates considered before the top-N cap. */
  totalCandidates: number;
  /** Anomaly candidates suppressed by `TOP_N_ANOMALIES`. */
  suppressedByCap: number;
}

interface BuildBaselinesInput {
  transactions: AnomalyTxnRow[];
  categories: CategoryLookup[];
}

function lookbackRange(now: Date, months: number): MonthRange {
  // The baseline starts `months` calendar months before the start of the
  // current month and ends just before the current month begins.
  const current = currentMonthRange(now);
  const start = monthRange(
    current.start.getUTCFullYear(),
    current.start.getUTCMonth() - months,
  );
  return {
    key: `${start.key}…${current.key}`,
    start: start.start,
    end: new Date(current.start.getTime() - 24 * 60 * 60 * 1000),
    nextStart: current.start,
  };
}

function bucketKey(k: BaselineKey): string {
  return `${k.categoryId ?? UNCATEGORISED_KEY}::${k.kind}`;
}

function categoryLabelFor(
  categoryId: string | null,
  byId: Map<string, CategoryLookup>,
): string {
  if (categoryId === null) return "Uncategorised";
  const hit = byId.get(categoryId);
  return hit?.name ?? "(unknown category)";
}

/**
 * Build per-(categoryId, kind) baselines from the lookback window. Only
 * groups with at least `MIN_SAMPLE_SIZE` historical rows are returned.
 */
export function buildCategoryBaselines(
  input: BuildBaselinesInput,
  opts: BaselineOpts = {},
): CategoryBaseline[] {
  const now = opts.now ?? new Date();
  const lookback = opts.lookbackMonths ?? LOOKBACK_MONTHS;
  const minSize = opts.minSampleSize ?? MIN_SAMPLE_SIZE;
  const window = lookbackRange(now, lookback);

  const byCategory = new Map<string, CategoryLookup>();
  for (const c of input.categories) byCategory.set(c.id, c);

  const buckets = new Map<
    string,
    { key: BaselineKey; amounts: number[]; firstDate: Date; lastDate: Date }
  >();

  for (const t of input.transactions) {
    const time = t.occurredOn.getTime();
    if (time < window.start.getTime() || time >= window.nextStart.getTime()) {
      continue;
    }
    const key: BaselineKey = { categoryId: t.categoryId, kind: t.kind };
    const k = bucketKey(key);
    const existing = buckets.get(k);
    const amt = Number(t.amountMinor);
    if (existing) {
      existing.amounts.push(amt);
      if (time < existing.firstDate.getTime()) existing.firstDate = t.occurredOn;
      if (time > existing.lastDate.getTime()) existing.lastDate = t.occurredOn;
    } else {
      buckets.set(k, {
        key,
        amounts: [amt],
        firstDate: t.occurredOn,
        lastDate: t.occurredOn,
      });
    }
  }

  const baselines: CategoryBaseline[] = [];
  for (const { key, amounts, firstDate, lastDate } of buckets.values()) {
    if (amounts.length < minSize) continue;
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    // Sample stddev (n-1 divisor). amounts.length >= MIN_SAMPLE_SIZE >= 2.
    const variance =
      amounts.reduce((acc, a) => acc + (a - mean) ** 2, 0) /
      (amounts.length - 1);
    const stddev = Math.sqrt(variance);
    baselines.push({
      key,
      categoryLabel: categoryLabelFor(key.categoryId, byCategory),
      count: amounts.length,
      meanMinor: mean,
      stddevMinor: stddev,
      sampleStart: firstDate,
      sampleEnd: lastDate,
    });
  }

  // Stable sort by category label then kind so output is deterministic.
  baselines.sort((a, b) => {
    const labelCmp = a.categoryLabel.localeCompare(b.categoryLabel);
    if (labelCmp !== 0) return labelCmp;
    return a.key.kind.localeCompare(b.key.kind);
  });
  return baselines;
}

interface DetectInput {
  transactions: AnomalyTxnRow[];
  baselines: CategoryBaseline[];
}

interface DetectionResult {
  anomalies: AnomalyCandidate[];
  totalCandidates: number;
  suppressedByCap: number;
}

/**
 * Pick out current-month transactions that exceed the (z + abs) thresholds
 * for their (categoryId, kind) baseline. Returns at most `topN` results
 * sorted by descending |z-score|.
 */
export function detectAnomalies(
  input: DetectInput,
  opts: DetectOpts = {},
): DetectionResult {
  const now = opts.now ?? new Date();
  const z = opts.zThreshold ?? Z_THRESHOLD;
  const minAbs = opts.minAbsDeviationMinor ?? MIN_ABS_DEVIATION_MINOR;
  const cap = opts.topN ?? TOP_N_ANOMALIES;
  const current = currentMonthRange(now);

  const baselineByKey = new Map<string, CategoryBaseline>();
  for (const b of input.baselines) baselineByKey.set(bucketKey(b.key), b);

  const candidates: AnomalyCandidate[] = [];
  for (const t of input.transactions) {
    const time = t.occurredOn.getTime();
    if (time < current.start.getTime() || time >= current.nextStart.getTime()) {
      continue;
    }
    const key = bucketKey({ categoryId: t.categoryId, kind: t.kind });
    const baseline = baselineByKey.get(key);
    if (!baseline) continue;
    if (baseline.stddevMinor === 0) continue;
    const amount = Number(t.amountMinor);
    const deviation = amount - baseline.meanMinor;
    const absDeviation = Math.abs(deviation);
    if (absDeviation < minAbs) continue;
    const zScore = deviation / baseline.stddevMinor;
    if (Math.abs(zScore) < z) continue;
    candidates.push({
      ref: "",
      txnId: t.id,
      categoryId: t.categoryId,
      categoryLabel: baseline.categoryLabel,
      kind: t.kind,
      occurredOn: t.occurredOn,
      amountMinor: amount,
      zScore,
      direction: deviation >= 0 ? "above" : "below",
      deviationMinor: deviation,
      baseline: {
        meanMinor: baseline.meanMinor,
        stddevMinor: baseline.stddevMinor,
        sampleCount: baseline.count,
      },
    });
  }

  candidates.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  const top = candidates.slice(0, cap).map((c, idx) => ({
    ...c,
    ref: `anom-${idx + 1}`,
  }));
  return {
    anomalies: top,
    totalCandidates: candidates.length,
    suppressedByCap: Math.max(0, candidates.length - top.length),
  };
}

export interface BuildAnomalyReportInput {
  baseCurrency: string;
  transactions: AnomalyTxnRow[];
  categories: CategoryLookup[];
}

/**
 * End-to-end pure pipeline: build baselines, score current-month txns,
 * package the report. Used by the orchestrator and the unit tests.
 */
export function buildAnomalyReport(
  input: BuildAnomalyReportInput,
  opts: BaselineOpts & DetectOpts = {},
): AnomalyReport {
  const now = opts.now ?? new Date();
  const baselines = buildCategoryBaselines(
    { transactions: input.transactions, categories: input.categories },
    opts,
  );
  const detection = detectAnomalies(
    { transactions: input.transactions, baselines },
    opts,
  );
  const current = currentMonthRange(now);
  const lookback = lookbackRange(now, opts.lookbackMonths ?? LOOKBACK_MONTHS);
  return {
    generatedAt: now.toISOString(),
    baseCurrency: input.baseCurrency,
    current: {
      monthKey: current.key,
      start: current.start.toISOString().slice(0, 10),
      end: current.end.toISOString().slice(0, 10),
    },
    lookback: {
      months: opts.lookbackMonths ?? LOOKBACK_MONTHS,
      start: lookback.start.toISOString().slice(0, 10),
      end: lookback.end.toISOString().slice(0, 10),
    },
    thresholds: {
      zThreshold: opts.zThreshold ?? Z_THRESHOLD,
      minAbsDeviationMinor: opts.minAbsDeviationMinor ?? MIN_ABS_DEVIATION_MINOR,
      minSampleSize: opts.minSampleSize ?? MIN_SAMPLE_SIZE,
    },
    baselines,
    anomalies: detection.anomalies,
    totalCandidates: detection.totalCandidates,
    suppressedByCap: detection.suppressedByCap,
  };
}
