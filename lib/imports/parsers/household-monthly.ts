/*
 * Parser for the "Household Finance Management" CSV format.
 *
 * Layout (per assets/csv-record-tracker/Household Finance Management - YYYY*.csv):
 *
 *   row 0:  💰 Household Finance Management
 *   row 1:  Goal: …
 *   row 2:  January Income,, February Income,, …, June Income,
 *   row 3+: <label>,<value>,<label>,<value>,…    (data rows)
 *   row N:  Total,<sum>,Total,<sum>,…             (skipped)
 *   ↓ then "January Expenses" / "July Income" / "July Expenses" sections
 *
 * Each section spans 6 month-pairs across (12 columns). Each data row carries
 * the same label across all 6 month-pairs in that section. We turn each
 * non-blank value cell into a synthetic ParsedTransaction at YYYY-MM-01.
 *
 * Skipped: section headers (recognised by " Income" / " Expenses" suffix),
 * "Total" rows, blank cells.
 */

import Papa from "papaparse";

import { detectCurrency, parseMoneyCell } from "@/lib/imports/money-parse";
import type { ParsedImport, ParsedTransaction } from "@/lib/imports/types";

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

interface SectionContext {
  // Map column index → month number (1-12), for the value-bearing columns.
  monthByValueColumn: Map<number, number>;
  txnKind: "INCOME" | "EXPENSE";
}

function detectSection(row: string[]): SectionContext | null {
  // Section header rows look like:
  //   "January Income", "", "February Income", "", … (label cells in even idx)
  // or
  //   "January Expenses", "", "February Expenses", "", …
  const monthByValueColumn = new Map<number, number>();
  let kind: "INCOME" | "EXPENSE" | null = null;

  for (let i = 0; i < row.length; i += 1) {
    const cell = (row[i] ?? "").trim().toLowerCase();
    if (!cell) continue;
    const incomeMatch = MONTH_NAMES.find((m) => cell === `${m} income`);
    const expenseMatch = MONTH_NAMES.find(
      (m) => cell === `${m} expense` || cell === `${m} expenses`,
    );
    if (incomeMatch) {
      kind = "INCOME";
      monthByValueColumn.set(i + 1, MONTH_NAMES.indexOf(incomeMatch) + 1);
    } else if (expenseMatch) {
      kind = "EXPENSE";
      monthByValueColumn.set(i + 1, MONTH_NAMES.indexOf(expenseMatch) + 1);
    }
  }

  if (!kind || monthByValueColumn.size === 0) return null;
  return { monthByValueColumn, txnKind: kind };
}

function detectYearFromFilenameOrContent(csvText: string, filename?: string): number {
  if (filename) {
    const m = filename.match(/(20\d{2})/);
    if (m) return parseInt(m[1], 10);
  }
  // Fallback: first 20XX in the file body.
  const m = csvText.match(/(20\d{2})/);
  if (m) return parseInt(m[1], 10);
  return new Date().getUTCFullYear();
}

function parsePersonScope(label: string): "Junjie" | "Jinyou" | null {
  // Labels of the form "Salary - Junjie" / "招行卡 - Jinyou".
  const m = label.match(/[-—]\s*(Junjie|Jinyou)\s*$/i);
  if (!m) return null;
  return m[1].toLowerCase() === "junjie" ? "Junjie" : "Jinyou";
}

function isIgnorableLabel(label: string): boolean {
  const trimmed = label.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed === "total") return true;
  if (trimmed.endsWith("income") || trimmed.endsWith("expenses") || trimmed.endsWith("expense"))
    return true;
  return false;
}

export function parseHouseholdMonthly(
  csvText: string,
  options: { filename?: string } = {},
): ParsedImport<ParsedTransaction> {
  const parsed = Papa.parse<string[]>(csvText.replace(/^\uFEFF/, ""), {
    skipEmptyLines: false,
  });

  const rows = parsed.data;
  const notes: string[] = [];
  const records: ParsedTransaction[] = [];
  const year = detectYearFromFilenameOrContent(csvText, options.filename);

  let activeSection: SectionContext | null = null;

  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] ?? [];

    // Try to detect a new section header on this row.
    const newSection = detectSection(row);
    if (newSection) {
      activeSection = newSection;
      continue;
    }

    if (!activeSection) continue;

    // Each data row carries the same label in repeating label columns.
    // Value-bearing columns are taken from the active section context.
    for (const [valueColIdx, month] of activeSection.monthByValueColumn) {
      const labelColIdx = valueColIdx - 1;
      const label = (row[labelColIdx] ?? "").trim();
      const rawValue = (row[valueColIdx] ?? "").trim();
      if (isIgnorableLabel(label)) continue;
      const amountMinor = parseMoneyCell(rawValue);
      if (amountMinor == null) continue;
      const occurredOn = `${year}-${String(month).padStart(2, "0")}-01`;
      records.push({
        kind: "TRANSACTION",
        sourceRow: r + 1,
        sourceColumn: `col${valueColIdx + 1}`,
        originalLabel: label,
        rawValue,
        occurredOn,
        txnKind: activeSection.txnKind,
        label,
        personTag: parsePersonScope(label),
        amountMinor: Math.abs(amountMinor),
        currency: detectCurrency(rawValue),
      });
    }
  }

  records.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  const coversFrom = records[0]?.occurredOn;
  const coversTo = records[records.length - 1]?.occurredOn;

  if (records.length === 0) {
    notes.push("no transaction rows detected");
  }

  return {
    format: "HOUSEHOLD_MONTHLY",
    records,
    coversFrom,
    coversTo,
    notes,
  };
}
