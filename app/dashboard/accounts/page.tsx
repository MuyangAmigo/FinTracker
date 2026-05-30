import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PillTag } from "@/components/ui/pill-tag";
import { KIND_LABEL } from "@/components/charts/palette";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { AccountKind } from "@/lib/finance/net-worth";

export const dynamic = "force-dynamic";

/*
 * Phase 6 — Accounts index.
 *
 * Lists every active account with its latest snapshot. Acts as the entry
 * point to per-account drilldowns at /dashboard/accounts/[id].
 */
export default async function AccountsPage() {
  await requireSession();

  const accounts = await prisma.account.findMany({
    where: { householdId: CURRENT_HOUSEHOLD_ID, archivedAt: null },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      currency: true,
      snapshots: {
        orderBy: { asOf: "desc" },
        take: 1,
        select: { asOf: true, balanceMinor: true, currency: true },
      },
    },
  });

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <PillTag>Accounts</PillTag>
          <h1 className="font-display-md mt-3 text-on-primary">
            Accounts
          </h1>
          <p className="font-body-md mt-1 text-on-primary/70">
            Active accounts with their most recent balance snapshot. Open one
            for trend and variance hints.
          </p>
        </header>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          {accounts.length === 0 ? (
            <p className="font-body-md text-on-primary/70">
              No active accounts yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="font-body-md min-w-full text-left text-on-primary">
                <thead className="font-micro-cap text-on-primary/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Kind</th>
                    <th className="py-2 pr-4">As of</th>
                    <th className="py-2 pr-4 text-right">Latest balance</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => {
                    const latest = a.snapshots[0];
                    return (
                      <tr key={a.id} className="border-b border-white/5">
                        <td className="py-2 pr-4">{a.name}</td>
                        <td className="py-2 pr-4 text-on-primary/80">
                          {KIND_LABEL[a.kind as AccountKind] ?? a.kind}
                        </td>
                        <td className="py-2 pr-4 tabular-money text-on-primary/70">
                          {latest
                            ? latest.asOf.toISOString().slice(0, 10)
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {latest ? (
                            <Money
                              value={{
                                amountMinor: Number(latest.balanceMinor),
                                currency: latest.currency,
                              }}
                              className="text-on-primary"
                            />
                          ) : (
                            <span className="text-on-primary/60">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <Link
                            href={`/dashboard/accounts/${a.id}`}
                            className="font-micro-cap text-primary-soft hover:underline"
                          >
                            Open →
                          </Link>
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
