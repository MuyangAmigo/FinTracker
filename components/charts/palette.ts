/*
 * Chart palette + shared helpers for Phase-6 SVG charts.
 *
 * The Stripi-inspired design system runs the dashboard surface on a deep
 * navy gradient, so chart colours are chosen to pop on dark backgrounds.
 * Source colours come from app/globals.css design tokens where possible;
 * we add a few derived hues for kinds that don't have a direct token.
 */

import type { AccountKind } from "@/lib/finance/net-worth";

export const CHART_PALETTE = {
  primary: "#533afd",
  primarySoft: "#665efd",
  primarySubdued: "#b9b9f9",
  ruby: "#ea2261",
  magenta: "#f96bee",
  canvasCream: "#f5e9d4",
  /* Custom mid-tones tuned for dark backgrounds. */
  amber: "#f7c98a",
  lavender: "#c9b8ff",
  teal: "#5fd9d0",
  sage: "#9bdab1",
  slate: "#7b8aa6",
} as const;

/**
 * Stable colour assignment per AccountKind. Liabilities use ruby so they
 * read as "draws down the stack"; the long tail uses a slate grey.
 */
export const KIND_COLOUR: Record<AccountKind, string> = {
  CASH: CHART_PALETTE.primarySoft,
  BANK: CHART_PALETTE.primarySubdued,
  WALLET: CHART_PALETTE.lavender,
  CREDIT_CARD: CHART_PALETTE.ruby,
  BROKERAGE: CHART_PALETTE.magenta,
  ESPP: CHART_PALETTE.amber,
  INSURANCE: CHART_PALETTE.teal,
  INVESTMENT: CHART_PALETTE.canvasCream,
  LIABILITY: CHART_PALETTE.ruby,
  OTHER: CHART_PALETTE.slate,
};

export const KIND_LABEL: Record<AccountKind, string> = {
  CASH: "Cash",
  BANK: "Bank",
  WALLET: "Wallet",
  CREDIT_CARD: "Credit card",
  BROKERAGE: "Brokerage",
  ESPP: "ESPP",
  INSURANCE: "Insurance",
  INVESTMENT: "Investment",
  LIABILITY: "Liability",
  OTHER: "Other",
};

/**
 * Stable palette for category donut slices. Skips ruby (reserved for
 * negatives) and cycles through the cooler tones first.
 */
export const CATEGORY_PALETTE = [
  CHART_PALETTE.primarySoft,
  CHART_PALETTE.primarySubdued,
  CHART_PALETTE.magenta,
  CHART_PALETTE.lavender,
  CHART_PALETTE.canvasCream,
  CHART_PALETTE.amber,
  CHART_PALETTE.teal,
  CHART_PALETTE.sage,
  CHART_PALETTE.slate,
  CHART_PALETTE.primary,
];

/**
 * Compact number formatter for axis labels and tooltips.
 * 1_234_567 → "1.2M", 50_000 → "50K".
 */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toFixed(0);
}

/**
 * Generate a small set of round axis ticks between 0 and `max`. Returns
 * 3–5 evenly-spaced values for the y-axis labels.
 */
export function niceTicks(max: number, count: number = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const exponent = Math.floor(Math.log10(rough));
  const fraction = rough / Math.pow(10, exponent);
  let nice: number;
  if (fraction < 1.5) nice = 1;
  else if (fraction < 3) nice = 2;
  else if (fraction < 7) nice = 5;
  else nice = 10;
  const step = nice * Math.pow(10, exponent);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) {
    ticks.push(v);
  }
  return ticks;
}
