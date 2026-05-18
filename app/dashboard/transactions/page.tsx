import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PillTag } from "@/components/ui/pill-tag";
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

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  INVESTMENT_CONTRIBUTION: "Investment in",
  INVESTMENT_WITHDRAWAL: "Investment out",
  ADJUSTMENT: "Adjustment",
};

interface SearchParams {
  month?: string;
  kind?: string;
  personTag?: string;
}

export default async function TransactionsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSession();
  const sp = await searchParams;

  const range = sp.month
    ? safeMonthRange(sp.month)
    : currentMonthRange();

  const kindFilter = sp.kind?.toUpperCase();
  const personFilter = sp.personTag;

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId: CURRENT_HOUSEHOLD_ID,
      occurredOn: { gte: range.start, lt: range.nextStart },
      ...(kindFilter ? { kind: kindFilter as never } : {}),
      ...(personFilter
        ? personFilter === "__none__"
          ? { personTag: null }
          : { personTag: personFilter }
        : {}),
    },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    include: {
      account: { select: { name: true } },
      fromAccount: { select: { name: true } },
      toAccount: { select: { name: true } },
      category: { select: { name: true, nameZh: true } },
    },
    take: 200,
  });

  const monthLabel = formatMonthLabel(range);
  const prevKey = previousMonthRange(range).key;
  const nextKey = nextMonthRange(range).key;

  const personTags = await prisma.transaction.findMany({
    where: {
      householdId: CURRENT_HOUSEHOLD_ID,
      personTag: { not: null },
    },
    distinct: ["personTag"],
    select: { personTag: true },
    take: 20,
  });
  const personTagOptions = personTags
    .map((p) => p.personTag!)
    .filter(Boolean)
    .sort();

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <PillTag>Transactions · {monthLabel}</PillTag>
            <h1 className="font-display-md mt-3 text-on-primary">
              Ledger
            </h1>
            <p className="font-body-md mt-1 text-on-primary/70">
              {transactions.length} {transactions.length === 1 ? "entry" : "entries"} this month
            </p>
          </div>
          <Link href="/dashboard/transactions/new">
            <Button variant="onDark">Add transaction</Button>
          </Link>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <MonthNav prevKey={prevKey} nextKey={nextKey} monthKey={range.key} kindFilter={kindFilter} personFilter={personFilter} />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <KindFilters current={kindFilter} monthKey={range.key} personFilter={personFilter} />
        </div>

        {personTagOptions.length > 0 ? (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <PersonFilters
              current={personFilter}
              options={personTagOptions}
              monthKey={range.key}
              kindFilter={kindFilter}
            />
          </div>
        ) : null}

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          {transactions.length === 0 ? (
            <p className="font-body-md text-on-primary/70">
              Nothing recorded for {monthLabel}.{" "}
              <Link
                href="/dashboard/transactions/new"
                className="underline decoration-primary-soft underline-offset-4 hover:text-on-primary"
              >
                Add the first one
              </Link>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="font-body-md min-w-full text-left text-on-primary">
                <thead className="font-micro-cap text-on-primary/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Kind</th>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Payer</th>
                    <th className="py-2 pr-4">Payee / note</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-white/5">
                      <td className="py-2 pr-4 tabular-money">
                        {t.occurredOn.toISOString().slice(0, 10)}
                      </td>
                      <td className="font-micro-cap py-2 pr-4 text-on-primary/70">
                        {KIND_LABEL[t.kind] ?? t.kind}
                      </td>
                      <td className="py-2 pr-4">
                        {t.kind === "TRANSFER"
                          ? `${t.fromAccount?.name ?? "?"} → ${t.toAccount?.name ?? "?"}`
                          : (t.account?.name ?? "—")}
                      </td>
                      <td className="py-2 pr-4">
                        {t.category
                          ? `${t.category.name}${t.category.nameZh ? ` · ${t.category.nameZh}` : ""}`
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">{t.personTag ?? "—"}</td>
                      <td className="max-w-xs py-2 pr-4 text-on-primary/80">
                        <span className="block truncate">
                          {t.payee ?? t.note ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <Money
                          value={{
                            amountMinor: Number(t.amountMinor),
                            currency: t.currency,
                          }}
                          tone={t.kind === "EXPENSE" ? "negative" : "neutral"}
                          className="text-on-primary"
                        />
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <Link
                          href={`/dashboard/transactions/${t.id}`}
                          className="font-micro-cap text-primary-soft hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) search.set(k, v);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function MonthNav({
  prevKey,
  nextKey,
  monthKey,
  kindFilter,
  personFilter,
}: {
  prevKey: string;
  nextKey: string;
  monthKey: string;
  kindFilter?: string;
  personFilter?: string;
}) {
  return (
    <>
      <Link
        href={`/dashboard/transactions${buildQuery({ month: prevKey, kind: kindFilter, personTag: personFilter })}`}
        className="rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
      >
        ← Previous
      </Link>
      <span className="font-body-md text-on-primary">{monthKey}</span>
      <Link
        href={`/dashboard/transactions${buildQuery({ month: nextKey, kind: kindFilter, personTag: personFilter })}`}
        className="rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
      >
        Next →
      </Link>
    </>
  );
}

function KindFilters({
  current,
  monthKey,
  personFilter,
}: {
  current?: string;
  monthKey: string;
  personFilter?: string;
}) {
  const filters: { label: string; value?: string }[] = [
    { label: "All" },
    { label: "Income", value: "INCOME" },
    { label: "Expense", value: "EXPENSE" },
    { label: "Transfer", value: "TRANSFER" },
  ];
  return (
    <>
      <span className="font-micro-cap text-on-primary/60">Kind:</span>
      {filters.map((f) => {
        const active = (current ?? undefined) === f.value;
        return (
          <Link
            key={f.label}
            href={`/dashboard/transactions${buildQuery({ month: monthKey, kind: f.value, personTag: personFilter })}`}
            className={
              active
                ? "rounded-pill bg-primary px-3 py-1 font-button-sm text-on-primary"
                : "rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
            }
          >
            {f.label}
          </Link>
        );
      })}
    </>
  );
}

function PersonFilters({
  current,
  options,
  monthKey,
  kindFilter,
}: {
  current?: string;
  options: string[];
  monthKey: string;
  kindFilter?: string;
}) {
  const choices = [{ label: "All", value: undefined }, ...options.map((o) => ({ label: o, value: o }))];
  return (
    <>
      <span className="font-micro-cap text-on-primary/60">Payer:</span>
      {choices.map((c) => {
        const active = current === c.value;
        return (
          <Link
            key={c.label}
            href={`/dashboard/transactions${buildQuery({ month: monthKey, kind: kindFilter, personTag: c.value })}`}
            className={
              active
                ? "rounded-pill bg-primary px-3 py-1 font-button-sm text-on-primary"
                : "rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
            }
          >
            {c.label}
          </Link>
        );
      })}
    </>
  );
}
