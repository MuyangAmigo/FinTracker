/*
 * Parser for the "Personal Overview" CSV format.
 *
 * Layout:
 *   row 0:  Month, <Account 1>, <Account 2>, …, Grand Total, Personal Total, …
 *   row 1+: 2024 Jan, ¥amount, ¥amount, …, ¥grandTotal, ¥personalTotal, …
 *
 * Output: one ParsedAccountSnapshot per (data row × account column).
 * Skipped: total/derived columns ("Grand Total", "Personal Total",
 * "Personal Cash Total", anything containing "Total"), and blank trailing
 * columns (the source files have ~13 trailing empty columns).
 */

import Papa from "papaparse";

import { detectCurrency, parseMoneyCell } from "@/lib/imports/money-parse";
import type {
  ParsedAccountSnapshot,
  ParsedImport,
} from "@/lib/imports/types";

const MONTH_TOKENS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function parseMonthLabel(raw: string): { year: number; month: number } | null {
  // Examples: "2024 Jan", "2022 June", "2024 Feb", "2024 September"
  const m = raw.trim().toLowerCase().match(/^(\d{4})\s+([a-z]+)/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = MONTH_TOKENS[m[2]];
  if (!month) return null;
  return { year, month };
}

function isDerivedColumn(header: string): boolean {
  const lower = header.toLowerCase();
  if (lower.includes("total")) return true;
  if (lower === "bank deposit") return true;
  if (lower === "investment") return true;
  if (lower === "notes" || lower === "note") return true;
  return false;
}

function isAccountHeader(header: string): boolean {
  if (!header || !header.trim()) return false;
  const lower = header.toLowerCase();
  if (lower === "month") return false;
  if (isDerivedColumn(lower)) return false;
  return true;
}

export function parsePersonalOverview(csvText: string): ParsedImport<ParsedAccountSnapshot> {
  const parsed = Papa.parse<string[]>(csvText.replace(/^\uFEFF/, ""), {
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  const notes: string[] = [];
  if (rows.length === 0) {
    return { format: "PERSONAL_OVERVIEW", records: [], notes: ["empty file"] };
  }

  // Find the header row. The 2022 layout has an entirely-blank leading column,
  // so the "Month" cell may not be at index 0; older 2022 files also have a
  // leading row that is all blanks before the real header. We probe the first
  // few rows to find the one containing a "Month" column.
  let headerRowIndex = -1;
  let monthColumnIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i += 1) {
    const candidate = rows[i] ?? [];
    const monthIdx = candidate.findIndex((cell) => (cell ?? "").trim().toLowerCase() === "month");
    if (monthIdx >= 0) {
      headerRowIndex = i;
      monthColumnIndex = monthIdx;
      break;
    }
  }
  if (headerRowIndex < 0) {
    return {
      format: "PERSONAL_OVERVIEW",
      records: [],
      notes: ["could not find 'Month' header row in first 5 rows"],
    };
  }

  const header = rows[headerRowIndex]!;
  const accountColumns: { idx: number; name: string }[] = [];
  for (let i = 0; i < header.length; i += 1) {
    if (i === monthColumnIndex) continue;
    const name = (header[i] ?? "").trim();
    if (!isAccountHeader(name)) continue;
    accountColumns.push({ idx: i, name });
  }

  if (accountColumns.length === 0) {
    notes.push("no account columns detected");
  }

  const records: ParsedAccountSnapshot[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
    const row = rows[r]!;
    const monthCell = (row[monthColumnIndex] ?? "").trim();
    const monthInfo = parseMonthLabel(monthCell);
    if (!monthInfo) {
      // Trailing blank rows or annotations.
      if (monthCell) notes.push(`row ${r + 1}: skipped non-month label "${monthCell}"`);
      continue;
    }

    const asOf = `${monthInfo.year}-${String(monthInfo.month).padStart(2, "0")}-01`;

    for (const col of accountColumns) {
      const cell = row[col.idx];
      const amountMinor = parseMoneyCell(cell);
      if (amountMinor == null) continue;
      records.push({
        kind: "ACCOUNT_SNAPSHOT",
        sourceRow: r + 1,
        sourceColumn: col.name,
        originalLabel: col.name,
        rawValue: cell,
        accountName: col.name,
        asOf,
        amountMinor,
        currency: detectCurrency(cell),
      });
    }
  }

  records.sort((a, b) => a.asOf.localeCompare(b.asOf));
  const coversFrom = records[0]?.asOf;
  const coversTo = records[records.length - 1]?.asOf;

  return {
    format: "PERSONAL_OVERVIEW",
    records,
    coversFrom,
    coversTo,
    notes,
  };
}
