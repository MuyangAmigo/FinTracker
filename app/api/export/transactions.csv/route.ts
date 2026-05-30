import { NextResponse } from "next/server";

import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fractionDigitsForCurrency } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/transactions.csv
 *
 * Streams the full household transaction history as RFC-4180 CSV. Amount is
 * rendered as major units in the transaction's native currency. Date columns
 * are ISO-8601 (YYYY-MM-DD).
 */
export async function GET() {
  await requireSession();

  const rows = await prisma.transaction.findMany({
    where: { householdId: CURRENT_HOUSEHOLD_ID },
    orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
    include: {
      account: { select: { name: true } },
      fromAccount: { select: { name: true } },
      toAccount: { select: { name: true } },
      category: { select: { name: true, nameZh: true } },
    },
  });

  const header = [
    "occurredOn",
    "kind",
    "scope",
    "account",
    "fromAccount",
    "toAccount",
    "category",
    "categoryZh",
    "personTag",
    "amount",
    "currency",
    "payee",
    "note",
  ];

  const lines: string[] = [header.join(",")];
  for (const t of rows) {
    const digits = fractionDigitsForCurrency(t.currency);
    const amountMajor = (Number(t.amountMinor) / 10 ** digits).toFixed(digits);
    lines.push(
      [
        t.occurredOn.toISOString().slice(0, 10),
        t.kind,
        t.scope,
        csvField(t.account?.name),
        csvField(t.fromAccount?.name),
        csvField(t.toAccount?.name),
        csvField(t.category?.name),
        csvField(t.category?.nameZh ?? null),
        csvField(t.personTag),
        amountMajor,
        t.currency,
        csvField(t.payee),
        csvField(t.note),
      ].join(","),
    );
  }
  const body = lines.join("\n") + "\n";
  const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * Escapes a CSV field per RFC 4180: wrap in double quotes when the value
 * contains a comma, double quote, newline, or starts/ends with whitespace.
 * Embedded double quotes are doubled.
 */
function csvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const needsQuoting = /[",\n\r]/.test(value) || /^\s|\s$/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}
