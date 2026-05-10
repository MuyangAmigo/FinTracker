/*
 * Common types for the import pipeline.
 *
 * The pipeline has three stages:
 *   1. detect    — identify the source CSV format from headers
 *   2. parse     — turn rows into typed staged records (no DB writes)
 *   3. stage     — persist staged records to import_rows for review
 *   4. commit    — promote approved rows into canonical tables
 *
 * Parsers return ParsedImport<T>. The `staged` array preserves the originating
 * row+column so the review UI can light up exactly the spreadsheet cell.
 */

export type ImportFormat = "PERSONAL_OVERVIEW" | "HOUSEHOLD_MONTHLY" | "UNKNOWN";

export interface SourceLocation {
  /** 1-based row number in the original CSV (header counts as row 1). */
  sourceRow: number;
  /** Optional column header name from the original CSV. */
  sourceColumn?: string;
  /** Original label as it appeared in the cell (label column). */
  originalLabel?: string;
  /** Original raw value cell (preserves currency symbol, parens, …). */
  rawValue?: string;
}

export interface ParsedAccountSnapshot extends SourceLocation {
  kind: "ACCOUNT_SNAPSHOT";
  /** Account display name from the column header. */
  accountName: string;
  /** YYYY-MM-01 representing month-end snapshot (we use first day of month). */
  asOf: string;
  amountMinor: number;
  currency: string;
}

export interface ParsedTransaction extends SourceLocation {
  kind: "TRANSACTION";
  /** Synthetic occurredOn date (first of month). */
  occurredOn: string;
  /** "INCOME" | "EXPENSE" — derived from section header. */
  txnKind: "INCOME" | "EXPENSE";
  /** Original label, e.g. "Salary - Junjie", "恋爱金", "招行卡 - Jinyou". */
  label: string;
  /** Optional person scope parsed from "X - Junjie" labels. */
  personTag?: "Junjie" | "Jinyou" | null;
  amountMinor: number;
  currency: string;
}

export type ParsedRecord = ParsedAccountSnapshot | ParsedTransaction;

export interface ParsedImport<T extends ParsedRecord = ParsedRecord> {
  format: ImportFormat;
  records: T[];
  /** Period covered, derived from earliest/latest dates. */
  coversFrom?: string;
  coversTo?: string;
  /** Human-readable diagnostics (skipped Total rows, blank cells, …). */
  notes: string[];
}
