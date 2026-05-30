/*
 * Category breakdown aggregation for the Phase-6 donut chart.
 *
 * Builds per-category totals (with optional `personTag` and `kind` filters)
 * sorted descending by amount. Small slices below a configurable threshold
 * are collapsed into a single "Other" bucket so the donut stays legible
 * when the long tail of categories has many tiny entries.
 */

import {
  monthlyTotalsByCategory,
  type TxnRow,
  type TransactionKind,
} from "@/lib/finance/aggregates";

export interface CategoryLookup {
  id: string;
  name: string;
  nameZh?: string | null;
}

export interface CategorySlice {
  categoryId: string | null;
  /** Bilingual display label. "Uncategorised" for null. "Other" for tail. */
  label: string;
  amountMinor: number;
  /** Share of the total in [0, 1]. */
  share: number;
  /** `true` when the slice was collapsed from multiple tail categories. */
  isOther: boolean;
}

export interface CategoryBreakdown {
  currency: string;
  totalMinor: number;
  slices: CategorySlice[];
}

export interface CategoryBreakdownOptions {
  baseCurrency: string;
  kind?: TransactionKind;
  /** `undefined` = all persons; pass `null` to filter to the null bucket. */
  personTag?: string | null;
  /**
   * Slices with `share < otherThreshold` are merged into an "Other" bucket.
   * Defaults to 0.03 (3%). Set to 0 to disable.
   */
  otherThreshold?: number;
}

function labelFor(
  categoryId: string | null,
  categories: ReadonlyMap<string, CategoryLookup>,
): string {
  if (categoryId === null) return "Uncategorised";
  const cat = categories.get(categoryId);
  if (!cat) return "Unknown";
  return cat.nameZh ? `${cat.name} · ${cat.nameZh}` : cat.name;
}

export function buildCategoryBreakdown(
  txns: TxnRow[],
  categories: CategoryLookup[],
  opts: CategoryBreakdownOptions,
): CategoryBreakdown {
  const threshold = opts.otherThreshold ?? 0.03;
  const lookup = new Map<string, CategoryLookup>();
  for (const c of categories) lookup.set(c.id, c);

  const totals = monthlyTotalsByCategory(txns, {
    baseCurrency: opts.baseCurrency,
    kind: opts.kind,
    personTag: opts.personTag,
  });

  const total = totals.reduce((s, t) => s + t.total.amountMinor, 0);
  if (total === 0) {
    return { currency: opts.baseCurrency, totalMinor: 0, slices: [] };
  }

  const rawSlices = totals
    .map((t) => ({
      categoryId: t.categoryId,
      label: labelFor(t.categoryId, lookup),
      amountMinor: t.total.amountMinor,
      share: t.total.amountMinor / total,
      isOther: false,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  if (threshold <= 0) {
    return {
      currency: opts.baseCurrency,
      totalMinor: total,
      slices: rawSlices,
    };
  }

  const major: CategorySlice[] = [];
  const tail: CategorySlice[] = [];
  for (const slice of rawSlices) {
    (slice.share < threshold ? tail : major).push(slice);
  }
  // Don't collapse a singleton tail — that just renames the same slice.
  if (tail.length <= 1) {
    return {
      currency: opts.baseCurrency,
      totalMinor: total,
      slices: rawSlices,
    };
  }
  const otherAmount = tail.reduce((s, t) => s + t.amountMinor, 0);
  major.push({
    categoryId: null,
    label: `Other (${tail.length})`,
    amountMinor: otherAmount,
    share: otherAmount / total,
    isOther: true,
  });
  return { currency: opts.baseCurrency, totalMinor: total, slices: major };
}
