/*
 * Import staging + commit service.
 *
 * Two-phase, non-destructive pipeline:
 *
 *   stageImport(parsed, filename) → writes Import + ImportRow rows. Each row
 *      carries the typed ParsedRecord in its `parsed` JSON column. Nothing
 *      lands in canonical tables yet.
 *
 *   commitImport(importId) → reads each ImportRow, resolves account/category,
 *      writes the canonical row (AccountSnapshot or Transaction), marks the
 *      ImportRow status accordingly. The canonical row carries `importRowId`
 *      so a future "undo import" is trivial.
 *
 * Re-running staging with the same payload is idempotent thanks to the
 * (importId, rowHash) unique constraint and `skipDuplicates`.
 *
 * Fuzzy account resolution: we match exactly first, then by token containment
 * (e.g. "CMB Bank" → "CMB · 招商银行"). Anything we can't resolve becomes a
 * row in `errors` so the review UI can prompt for a manual mapping.
 */

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import type {
  ImportFormat,
  ParsedAccountSnapshot,
  ParsedImport,
  ParsedRecord,
  ParsedTransaction,
} from "@/lib/imports/types";

const HOUSEHOLD_ID = CURRENT_HOUSEHOLD_ID;

function hashRecord(record: ParsedRecord): string {
  const seed =
    record.kind === "ACCOUNT_SNAPSHOT"
      ? `snap|${record.accountName}|${record.asOf}|${record.amountMinor}|${record.currency}`
      : `txn|${record.label}|${record.occurredOn}|${record.txnKind}|${record.amountMinor}|${record.currency}`;
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

export async function stageImport(args: {
  parsed: ParsedImport;
  filename: string;
  submittedByUserId?: string | null;
  blobPath?: string | null;
}): Promise<{ importId: string; rowsStaged: number }> {
  const { parsed, filename, submittedByUserId, blobPath } = args;

  const imp = await prisma.import.create({
    data: {
      householdId: HOUSEHOLD_ID,
      submittedById: submittedByUserId ?? null,
      filename,
      format: parsed.format as ImportFormat,
      blobPath: blobPath ?? null,
      coversFrom: parsed.coversFrom ? new Date(`${parsed.coversFrom}T00:00:00Z`) : null,
      coversTo: parsed.coversTo ? new Date(`${parsed.coversTo}T00:00:00Z`) : null,
      status: "PARSED",
    },
  });

  const rowData: Prisma.ImportRowCreateManyInput[] = parsed.records.map((r) => ({
    importId: imp.id,
    householdId: HOUSEHOLD_ID,
    sourceRow: r.sourceRow,
    sourceColumn: r.sourceColumn ?? null,
    originalLabel: r.originalLabel ?? null,
    rawValue: r.rawValue ?? null,
    rowHash: hashRecord(r),
    parsed: r as unknown as Prisma.InputJsonValue,
    status: "PARSED",
  }));

  await prisma.importRow.createMany({ data: rowData, skipDuplicates: true });

  return { importId: imp.id, rowsStaged: rowData.length };
}

// ----------------------------------------------------------------------------
// Resolution helpers
// ----------------------------------------------------------------------------

interface AccountIndexEntry {
  id: string;
  name: string;
  lower: string;
}

async function loadAccountIndex(): Promise<AccountIndexEntry[]> {
  const accounts = await prisma.account.findMany({
    where: { householdId: HOUSEHOLD_ID, archivedAt: null },
    select: { id: true, name: true },
  });
  return accounts.map((a) => ({ id: a.id, name: a.name, lower: a.name.toLowerCase() }));
}

function normalizeAccountToken(value: string): string {
  return value.toLowerCase().replace(/[\s_\-·]+/g, "").trim();
}

// Pre-resolution rewrites for known historical naming variants. The user has
// explicitly confirmed that "CITI Bank" in the legacy spreadsheets is a typo
// for "CITIC" (中信银行), so we collapse it before matching. Add new entries
// here when more variants surface.
function rewriteAccountName(input: string): string {
  return input
    .replace(/\bciti\s+bank\b/gi, "CITIC")
    .replace(/\bcitic\s+bank\b/gi, "CITIC");
}

function resolveAccount(name: string, index: AccountIndexEntry[]): string | null {
  const lower = rewriteAccountName(name).toLowerCase().trim();
  if (!lower) return null;
  const exact = index.find((a) => a.lower === lower);
  if (exact) return exact.id;
  // Token containment in either direction. We strip qualifier suffixes after " · ".
  const lhsBase = lower.split(" · ")[0];
  for (const a of index) {
    const rhsBase = a.lower.split(" · ")[0];
    if (rhsBase === lhsBase) return a.id;
    if (a.lower.includes(lhsBase) || lower.includes(rhsBase)) return a.id;
  }
  // Compact comparison: strip whitespace/separators so "WE Bank" matches
  // "WeBank" and "CITIC Saving" matches "CITIC Saving · 中信".
  const lhsCompact = normalizeAccountToken(lower);
  if (!lhsCompact) return null;
  for (const a of index) {
    const rhsCompact = normalizeAccountToken(a.lower);
    if (!rhsCompact) continue;
    if (rhsCompact === lhsCompact) return a.id;
    if (rhsCompact.includes(lhsCompact) || lhsCompact.includes(rhsCompact)) return a.id;
  }
  // Prefix match against the qualifier-stripped base. Guarded by length so
  // two-letter codes don't catch arbitrary tokens.
  for (const a of index) {
    const rhsBaseCompact = normalizeAccountToken(a.lower.split(" · ")[0]);
    if (rhsBaseCompact.length < 4) continue;
    if (lhsCompact.startsWith(rhsBaseCompact) || rhsBaseCompact.startsWith(lhsCompact)) {
      return a.id;
    }
  }
  return null;
}

async function ensureAggregateAccount(): Promise<string> {
  const name = "Aggregate · CSV imports";
  const existing = await prisma.account.findFirst({
    where: { householdId: HOUSEHOLD_ID, name },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.account.create({
    data: { householdId: HOUSEHOLD_ID, name, kind: "OTHER", currency: "CNY" },
  });
  return created.id;
}

interface CategoryIndexEntry {
  categoryId: string;
  label: string;
  lower: string;
}

async function loadCategoryAliasIndex(): Promise<CategoryIndexEntry[]> {
  const aliases = await prisma.categoryAlias.findMany({
    where: { householdId: HOUSEHOLD_ID, categoryId: { not: null } },
    select: { categoryId: true, label: true },
  });
  return aliases
    .filter((a): a is { categoryId: string; label: string } => a.categoryId !== null)
    .map((a) => ({ categoryId: a.categoryId, label: a.label, lower: a.label.toLowerCase() }));
}

function resolveCategoryByLabel(label: string, index: CategoryIndexEntry[]): string | null {
  const lower = label.toLowerCase().trim();
  if (!lower) return null;
  const exact = index.find((a) => a.lower === lower);
  if (exact) return exact.categoryId;
  // Allow partial matches when the alias label is a prefix (e.g. "Salary - X"
  // when the alias is "Salary - Junjie").
  const startsWith = index.find((a) => lower.startsWith(a.lower));
  return startsWith?.categoryId ?? null;
}

// ----------------------------------------------------------------------------
// Commit
// ----------------------------------------------------------------------------

export interface CommitSummary {
  committed: number;
  skipped: number;
  errors: { rowId: string; reason: string }[];
}

export async function commitImport(importId: string): Promise<CommitSummary> {
  const imp = await prisma.import.findUniqueOrThrow({
    where: { id: importId },
    include: { rows: true },
  });
  if (imp.householdId !== HOUSEHOLD_ID) {
    throw new Error("import does not belong to current household");
  }

  const summary: CommitSummary = { committed: 0, skipped: 0, errors: [] };

  const accountIndex = await loadAccountIndex();
  const categoryIndex = await loadCategoryAliasIndex();
  const aggregateAccountId = await ensureAggregateAccount();

  for (const row of imp.rows) {
    if (row.status === "COMMITTED" || row.status === "IGNORED") {
      summary.skipped += 1;
      continue;
    }

    const parsed = row.parsed as unknown as ParsedRecord | null;
    if (!parsed || typeof parsed !== "object" || !("kind" in parsed)) {
      summary.errors.push({ rowId: row.id, reason: "row missing parsed payload" });
      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: "ERROR", errorMessage: "missing parsed payload" },
      });
      continue;
    }

    try {
      if (parsed.kind === "ACCOUNT_SNAPSHOT") {
        await commitSnapshot(parsed, row.id, accountIndex);
      } else {
        await commitTransaction(parsed, row.id, accountIndex, categoryIndex, aggregateAccountId);
      }
      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: "COMMITTED", errorMessage: null },
      });
      summary.committed += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      summary.errors.push({ rowId: row.id, reason });
      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: "ERROR", errorMessage: reason },
      });
    }
  }

  await prisma.import.update({
    where: { id: importId },
    data: { status: summary.errors.length > 0 ? "REVIEWING" : "COMMITTED" },
  });

  return summary;
}

async function commitSnapshot(
  record: ParsedAccountSnapshot,
  rowId: string,
  accountIndex: AccountIndexEntry[],
) {
  const accountId = resolveAccount(record.accountName, accountIndex);
  if (!accountId) throw new Error(`unmapped account: "${record.accountName}"`);

  const asOf = new Date(`${record.asOf}T00:00:00Z`);

  // Idempotent on (accountId, asOf): re-commit overwrites the prior value.
  await prisma.accountSnapshot.upsert({
    where: { accountId_asOf: { accountId, asOf } },
    create: {
      householdId: HOUSEHOLD_ID,
      accountId,
      asOf,
      balanceMinor: BigInt(record.amountMinor),
      currency: record.currency,
      sourceHash: record.rawValue ?? null,
      importRowId: rowId,
    },
    update: {
      balanceMinor: BigInt(record.amountMinor),
      currency: record.currency,
      sourceHash: record.rawValue ?? null,
      importRowId: rowId,
    },
  });
}

async function commitTransaction(
  record: ParsedTransaction,
  rowId: string,
  accountIndex: AccountIndexEntry[],
  categoryIndex: CategoryIndexEntry[],
  aggregateAccountId: string,
) {
  const occurredOn = new Date(`${record.occurredOn}T00:00:00Z`);

  // Resolve account from the label if it looks like an account-style label
  // ("招行卡 - Junjie" → CMB account). Otherwise use the aggregate account.
  const labelAccountGuess = record.label
    .replace(/\s*[-—]\s*(Junjie|Jinyou)\s*$/i, "")
    .trim();
  const accountId = resolveAccount(labelAccountGuess, accountIndex) ?? aggregateAccountId;

  const categoryId = resolveCategoryByLabel(record.label, categoryIndex);

  const txnKind = record.txnKind === "INCOME" ? ("INCOME" as const) : ("EXPENSE" as const);

  // We can't natively upsert Transaction on importRowId because it's nullable;
  // instead we update-by-rowId-if-exists, otherwise create.
  const existing = await prisma.transaction.findFirst({
    where: { importRowId: rowId },
    select: { id: true },
  });

  const data: Prisma.TransactionUncheckedCreateInput = {
    householdId: HOUSEHOLD_ID,
    accountId,
    categoryId,
    kind: txnKind,
    scope: "HOUSEHOLD",
    occurredOn,
    amountMinor: BigInt(record.amountMinor),
    currency: record.currency,
    payee: record.label,
    note: `Imported from CSV row ${record.sourceRow}`,
    personTag: record.personTag ?? null,
    sourceHash: record.rawValue ?? null,
    importRowId: rowId,
  };

  if (existing) {
    await prisma.transaction.update({ where: { id: existing.id }, data });
  } else {
    await prisma.transaction.create({ data });
  }
}
