import { NextResponse } from "next/server";

import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fractionDigitsForCurrency } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/snapshots.csv
 *
 * Streams every account snapshot in the household as RFC-4180 CSV. Balance
 * is rendered as major units in the snapshot's native currency.
 */
export async function GET() {
  await requireSession();

  const rows = await prisma.accountSnapshot.findMany({
    where: { householdId: CURRENT_HOUSEHOLD_ID },
    orderBy: [{ asOf: "asc" }, { accountId: "asc" }],
    include: {
      account: { select: { name: true, kind: true } },
    },
  });

  const header = [
    "asOf",
    "accountName",
    "accountKind",
    "balance",
    "currency",
    "note",
  ];

  const lines: string[] = [header.join(",")];
  for (const s of rows) {
    const digits = fractionDigitsForCurrency(s.currency);
    const balanceMajor = (Number(s.balanceMinor) / 10 ** digits).toFixed(
      digits,
    );
    lines.push(
      [
        s.asOf.toISOString().slice(0, 10),
        csvField(s.account?.name),
        s.account?.kind ?? "",
        balanceMajor,
        s.currency,
        csvField(s.note),
      ].join(","),
    );
  }
  const body = lines.join("\n") + "\n";
  const filename = `snapshots-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function csvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const needsQuoting = /[",\n\r]/.test(value) || /^\s|\s$/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}
