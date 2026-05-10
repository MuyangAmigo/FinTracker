/*
 * Money parser for legacy CSV cells.
 *
 * Handles the variants observed in assets/csv-record-tracker/:
 *   "¥321,373.49"      → +321373.49
 *   "$1,200.00"        → +1200.00
 *   "(¥547.40)"        → -547.40   (accounting negative)
 *   "¥0.00 "           → 0          (trailing whitespace)
 *   "-1234.56"         → -1234.56
 *   "" / "-" / null    → null       (blank)
 *
 * Returns an integer minor-unit amount (CNY/USD/etc. all assumed 2 digits)
 * because everything we ever import is in 2-digit currencies. JPY/KRW would
 * need a different fraction-digit handling path.
 */

const CURRENCY_PREFIX = /^[¥$€£HKD\s]+/;

export function parseMoneyCell(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s || s === "-" || s === "—") return null;

  let negative = false;
  // Accounting negative: surrounding parens.
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  // Leading minus.
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1).trim();
  }
  // Strip currency symbol(s) and any whitespace prefix.
  s = s.replace(CURRENCY_PREFIX, "");
  // Strip thousands separators.
  s = s.replace(/,/g, "");
  // Trailing whitespace already trimmed; remove any stray symbols.
  s = s.trim();

  if (!/^\d+(\.\d+)?$/.test(s)) return null;

  const major = parseFloat(s);
  if (!Number.isFinite(major)) return null;

  const minor = Math.round(major * 100);
  return negative ? -minor : minor;
}

/**
 * Detect the currency symbol present in a value cell. Defaults to CNY when no
 * symbol is found, since every observed legacy file is in CNY.
 */
export function detectCurrency(input: string | null | undefined): string {
  if (input == null) return "CNY";
  const s = String(input);
  if (s.includes("¥")) return "CNY";
  if (s.includes("$")) return "USD";
  if (s.includes("€")) return "EUR";
  if (s.includes("£")) return "GBP";
  if (/HKD/i.test(s)) return "HKD";
  return "CNY";
}
