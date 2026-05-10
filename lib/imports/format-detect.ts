/*
 * Format detection for legacy finance CSVs.
 *
 * Returns one of:
 *   "PERSONAL_OVERVIEW" — a "Finance YYYY - Overview" file
 *   "HOUSEHOLD_MONTHLY" — a "Household Finance Management" file
 *   "UNKNOWN"           — anything else
 */

import Papa from "papaparse";

import type { ImportFormat } from "@/lib/imports/types";

export function detectImportFormat(csvText: string): ImportFormat {
  const head = csvText.replace(/^\uFEFF/, "").slice(0, 2000);

  if (
    head.includes("Household Finance Management") ||
    head.includes("January Income") ||
    head.includes("January Expenses")
  ) {
    return "HOUSEHOLD_MONTHLY";
  }

  // Personal overview files are characterized by a "Month" column header
  // followed by named account columns (Alipay/WeChat/CMB/...). Earlier 2022
  // files put the header on row 2 with a blank leading column, so we scan
  // the first few rows instead of only inspecting row 0.
  const parsed = Papa.parse<string[]>(head, { skipEmptyLines: true });
  const probe = parsed.data.slice(0, 5);
  const hasMonthHeader = probe.some((row) =>
    (row ?? []).some((cell) => (cell ?? "").trim().toLowerCase() === "month"),
  );
  const hasAlipay = probe.some((row) =>
    (row ?? []).some((cell) => (cell ?? "").toLowerCase().includes("alipay")),
  );
  const hasTotal = probe.some((row) =>
    (row ?? []).some((cell) => (cell ?? "").toLowerCase().includes("total")),
  );
  if (hasMonthHeader && hasAlipay && hasTotal) {
    return "PERSONAL_OVERVIEW";
  }

  return "UNKNOWN";
}
