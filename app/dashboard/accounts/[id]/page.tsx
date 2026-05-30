import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PillTag } from "@/components/ui/pill-tag";
import { LineChart } from "@/components/charts/line-chart";
import { KIND_LABEL } from "@/components/charts/palette";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { AccountKind } from "@/lib/finance/net-worth";

export const dynamic = "force-dynamic";

/*
 * Phase 6 — Per-account drilldown.
 *
 * Three panels:
 *   1. Snapshot trend (line chart of month-end balances)
 *   2. Recent transactions affecting this account (last 50)
 *   3. Variance hints: between consecutive snapshots, compare the snapshot
 *      delta against the sum of transactions in the interval. Differences
 *      > 1% of the snapshot value get a hint that the snapshot may include
 *      market gains/losses or untracked activity worth investigating.
 */
export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const account = await prisma.account.findFirst({
    where: { id, householdId: CURRENT_HOUSEHOLD_ID },
    select: {
      id: true,
      name: true,
      kind: true,
      currency: true,
      archivedAt: true,
    },
  });
  if (!account) notFound();

  const [snapshots, transactions] = await Promise.all([
    prisma.accountSnapshot.findMany({
      where: { householdId: CURRENT_HOUSEHOLD_ID, accountId: id },
      orderBy: { asOf: "asc" },
      select: { asOf: true, balanceMinor: true, currency: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: CURRENT_HOUSEHOLD_ID,
        OR: [
          { accountId: id },
          { fromAccountId: id },
          { toAccountId: id },
        ],
      },
      orderBy: { occurredOn: "desc" },
      take: 50,
      include: {
        category: { select: { name: true, nameZh: true } },
        account: { select: { name: true } },
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
      },
    }),
  ]);

  const trendPoints = snapshots.map((s) => ({
    label: s.asOf.toISOString().slice(0, 7),
    value: Number(s.balanceMinor),
  }));

  const variances = computeVariances(id, snapshots, transactions);

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <PillTag>
            Account · {KIND_LABEL[account.kind as AccountKind] ?? account.kind}
            {account.archivedAt ? " · archived" : ""}
          </PillTag>
          <h1 className="font-display-md mt-3 text-on-primary">
            {account.name}
          </h1>
          <p className="font-body-md mt-1 text-on-primary/70">
            Native currency {account.currency}.{" "}
            <Link
              href="/dashboard/accounts"
              className="text-primary-soft hover:underline"
            >
              All accounts ←
            </Link>
          </p>
        </header>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 mb-6 text-on-primary"
        >
          <p className="font-micro-cap mb-3 text-on-primary/60">
            Snapshot trend
          </p>
          {trendPoints.length === 0 ? (
            <p className="font-body-md py-6 text-on-primary/60">
              No snapshots yet.{" "}
              <Link
                href="/dashboard/snapshots"
                className="text-primary-soft hover:underline"
              >
                Log balances →
              </Link>
            </p>
          ) : (
            <LineChart
              points={trendPoints}
              ariaLabel={`Balance trend for ${account.name}`}
              height={220}
            />
          )}
        </Card>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 mb-6 text-on-primary"
        >
          <p className="font-micro-cap mb-3 text-on-primary/60">
            Variance hints
          </p>
          {variances.length === 0 ? (
            <p className="font-body-md text-on-primary/70">
              Snapshots and transactions reconcile within 1% — nothing
              unusual to surface.
            </p>
          ) : (
            <ul className="space-y-2">
              {variances.map((v) => (
                <li
                  key={`${v.fromAsOf}-${v.toAsOf}`}
                  className="font-body-md flex flex-wrap items-baseline gap-x-3 text-on-primary/85"
                >
                  <span className="font-micro-cap text-on-primary/60">
                    {v.fromAsOf} → {v.toAsOf}
                  </span>
                  <span>
                    snapshot Δ{" "}
                    <Money
                      value={{
                        amountMinor: v.snapshotDeltaMinor,
                        currency: account.currency,
                      }}
                      className="text-on-primary"
                      formatOptions={{ signed: true }}
                    />
                  </span>
                  <span>
                    txn sum{" "}
                    <Money
                      value={{
                        amountMinor: v.txnSumMinor,
                        currency: account.currency,
                      }}
                      className="text-on-primary"
                      formatOptions={{ signed: true }}
                    />
                  </span>
                  <span
                    className={
                      v.residualMinor < 0
                        ? "text-ruby"
                        : "text-canvas-cream"
                    }
                  >
                    residual{" "}
                    <Money
                      value={{
                        amountMinor: v.residualMinor,
                        currency: account.currency,
                      }}
                      className={
                        v.residualMinor < 0 ? "text-ruby" : "text-canvas-cream"
                      }
                      formatOptions={{ signed: true }}
                    />
                  </span>
                </li>
              ))}
              <li className="font-micro pt-2 text-on-primary/55">
                Residual = snapshot delta − transaction sum. Non-zero values
                usually reflect market gains/losses (investments) or activity
                that wasn&apos;t recorded as a transaction.
              </li>
            </ul>
          )}
        </Card>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          <p className="font-micro-cap mb-3 text-on-primary/60">
            Recent transactions
          </p>
          {transactions.length === 0 ? (
            <p className="font-body-md text-on-primary/70">
              No transactions touch this account yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="font-body-md min-w-full text-left text-on-primary">
                <thead className="font-micro-cap text-on-primary/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Kind</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Note</th>
                    <th className="py-2 pr-4 text-right">Effect</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const effect = transactionEffect(t, id);
                    return (
                      <tr key={t.id} className="border-b border-white/5">
                        <td className="py-2 pr-4 tabular-money">
                          {t.occurredOn.toISOString().slice(0, 10)}
                        </td>
                        <td className="font-micro-cap py-2 pr-4 text-on-primary/70">
                          {t.kind}
                        </td>
                        <td className="py-2 pr-4">
                          {t.category
                            ? `${t.category.name}${t.category.nameZh ? ` · ${t.category.nameZh}` : ""}`
                            : "—"}
                        </td>
                        <td className="max-w-xs py-2 pr-4 text-on-primary/80">
                          <span className="block truncate">
                            {t.payee ?? t.note ?? "—"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <Money
                            value={{
                              amountMinor: effect,
                              currency: t.currency,
                            }}
                            className={
                              effect < 0
                                ? "text-ruby"
                                : "text-on-primary"
                            }
                            formatOptions={{ signed: true }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

interface VarianceRow {
  fromAsOf: string;
  toAsOf: string;
  snapshotDeltaMinor: number;
  txnSumMinor: number;
  residualMinor: number;
}

function computeVariances(
  accountId: string,
  snapshots: { asOf: Date; balanceMinor: bigint }[],
  transactions: Array<{
    occurredOn: Date;
    kind: string;
    amountMinor: bigint;
    accountId: string | null;
    fromAccountId: string | null;
    toAccountId: string | null;
  }>,
): VarianceRow[] {
  if (snapshots.length < 2) return [];
  const out: VarianceRow[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const snapshotDelta =
      Number(curr.balanceMinor) - Number(prev.balanceMinor);
    let txnSum = 0;
    for (const t of transactions) {
      if (
        t.occurredOn.getTime() <= prev.asOf.getTime() ||
        t.occurredOn.getTime() > curr.asOf.getTime()
      ) {
        continue;
      }
      txnSum += transactionEffect(t, accountId);
    }
    const residual = snapshotDelta - txnSum;
    const threshold = Math.max(Math.abs(Number(curr.balanceMinor)) * 0.01, 100);
    if (Math.abs(residual) > threshold) {
      out.push({
        fromAsOf: prev.asOf.toISOString().slice(0, 10),
        toAsOf: curr.asOf.toISOString().slice(0, 10),
        snapshotDeltaMinor: snapshotDelta,
        txnSumMinor: txnSum,
        residualMinor: residual,
      });
    }
  }
  return out;
}

/**
 * Signed effect of a single transaction on a particular account's balance.
 * Income lifts the primary account; expense drops it; a transfer's `from`
 * account drops while its `to` account lifts.
 */
function transactionEffect(
  t: {
    kind: string;
    amountMinor: bigint;
    accountId: string | null;
    fromAccountId: string | null;
    toAccountId: string | null;
  },
  accountId: string,
): number {
  const amount = Number(t.amountMinor);
  if (t.kind === "TRANSFER") {
    if (t.fromAccountId === accountId) return -amount;
    if (t.toAccountId === accountId) return amount;
    return 0;
  }
  if (t.accountId !== accountId) return 0;
  switch (t.kind) {
    case "INCOME":
    case "INVESTMENT_WITHDRAWAL":
      return amount;
    case "EXPENSE":
    case "INVESTMENT_CONTRIBUTION":
      return -amount;
    case "ADJUSTMENT":
      // Adjustments are signed in the source spreadsheet but stored as
      // positive amountMinor here. Without a sign column they're treated as
      // additive; users should re-record signed adjustments explicitly.
      return amount;
    default:
      return 0;
  }
}
