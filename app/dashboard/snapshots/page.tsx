import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PillTag } from "@/components/ui/pill-tag";
import {
  SnapshotGrid,
  type SnapshotRow,
} from "@/components/finance/snapshot-grid";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  currentMonthRange,
  formatMonthLabel,
  monthRangeFromKey,
  nextMonthRange,
  previousMonthRange,
} from "@/lib/finance/period";
import { fractionDigitsForCurrency } from "@/lib/money";

import { saveSnapshotsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SnapshotsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;

  const range = sp.month ? safeMonthRange(sp.month) : currentMonthRange();
  const monthLabel = formatMonthLabel(range);

  const accounts = await prisma.account.findMany({
    where: { householdId: CURRENT_HOUSEHOLD_ID, archivedAt: null },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: { id: true, name: true, kind: true, currency: true },
  });

  // Most recent snapshot at or before this month-end, per account.
  const latestSnapshots = await prisma.accountSnapshot.findMany({
    where: {
      householdId: CURRENT_HOUSEHOLD_ID,
      accountId: { in: accounts.map((a) => a.id) },
      asOf: { lte: range.end },
    },
    orderBy: [{ accountId: "asc" }, { asOf: "desc" }],
  });
  const latestByAccount = new Map<
    string,
    { balanceMinor: bigint; currency: string; asOf: Date }
  >();
  for (const s of latestSnapshots) {
    if (!latestByAccount.has(s.accountId)) {
      latestByAccount.set(s.accountId, {
        balanceMinor: s.balanceMinor,
        currency: s.currency,
        asOf: s.asOf,
      });
    }
  }

  const rows: SnapshotRow[] = accounts.map((a) => {
    const latest = latestByAccount.get(a.id);
    let initialValue = "";
    let asOfIso: string | null = null;
    if (latest) {
      const digits = fractionDigitsForCurrency(latest.currency);
      const major = Number(latest.balanceMinor) / 10 ** digits;
      initialValue = major.toFixed(digits);
      asOfIso = latest.asOf.toISOString().slice(0, 10);
    }
    return {
      accountId: a.id,
      accountName: a.name,
      accountKind: a.kind,
      currency: a.currency,
      initialValue,
      asOf: asOfIso,
    };
  });

  const prevKey = previousMonthRange(range).key;
  const nextKey = nextMonthRange(range).key;

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <PillTag>Snapshots · {monthLabel}</PillTag>
            <h1 className="font-display-md mt-3 text-on-primary">
              Month-end balances
            </h1>
            <p className="font-body-md mt-1 text-on-primary/70">
              One value per active account. Blank rows are skipped.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/snapshots?month=${prevKey}`}
              className="rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
            >
              ← {prevKey}
            </Link>
            <Link
              href={`/dashboard/snapshots?month=${nextKey}`}
              className="rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
            >
              {nextKey} →
            </Link>
          </div>
        </header>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          {rows.length === 0 ? (
            <p className="font-body-md text-on-primary/70">
              No active accounts in this household yet. Add an account first.
            </p>
          ) : (
            <SnapshotGrid
              monthKey={range.key}
              rows={rows}
              action={saveSnapshotsAction}
            />
          )}
        </Card>
      </div>
    </main>
  );
}

function safeMonthRange(key: string) {
  try {
    return monthRangeFromKey(key);
  } catch {
    return currentMonthRange();
  }
}
