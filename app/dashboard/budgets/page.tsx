import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PillTag } from "@/components/ui/pill-tag";
import {
  EditBudgetRowForm,
  NewBudgetRowForm,
  SavingsGoalForm,
} from "@/components/finance/budget-row-form";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  lookupCategorySpend,
  monthlyIncomeExpenseSavings,
  monthlyTotalsByCategory,
} from "@/lib/finance/aggregates";
import type { TxnRow } from "@/lib/finance/aggregates";
import {
  currentMonthRange,
  formatMonthLabel,
  monthRangeFromKey,
  nextMonthRange,
  previousMonthRange,
} from "@/lib/finance/period";
import { fractionDigitsForCurrency } from "@/lib/money";

import {
  deleteBudgetAction,
  saveSavingsGoalAction,
  updateBudgetAction,
  createBudgetAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;

  const range = sp.month ? safeMonthRange(sp.month) : currentMonthRange();
  const monthLabel = formatMonthLabel(range);

  const [household, categories, budgets, txns] = await Promise.all([
    prisma.household.findUnique({
      where: { id: CURRENT_HOUSEHOLD_ID },
      select: { baseCurrency: true, savingsGoalRate: true },
    }),
    prisma.category.findMany({
      where: {
        householdId: CURRENT_HOUSEHOLD_ID,
        isArchived: false,
        kind: "EXPENSE",
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameZh: true },
    }),
    prisma.budget.findMany({
      where: {
        householdId: CURRENT_HOUSEHOLD_ID,
        period: "MONTHLY",
        periodStart: range.start,
      },
      orderBy: [{ personTag: "asc" }, { categoryId: "asc" }],
      include: {
        category: { select: { name: true, nameZh: true } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: CURRENT_HOUSEHOLD_ID,
        occurredOn: { gte: range.start, lt: range.nextStart },
      },
      select: {
        kind: true,
        amountMinor: true,
        currency: true,
        categoryId: true,
        personTag: true,
      },
    }),
  ]);

  const baseCurrency = household?.baseCurrency ?? "CNY";
  const totals = monthlyIncomeExpenseSavings(txns as TxnRow[], baseCurrency);

  const savingsGoalFraction = household?.savingsGoalRate
    ? Number(household.savingsGoalRate)
    : 0.6;
  const savingsGoalPercent = (savingsGoalFraction * 100).toFixed(0);
  const actualSavingsPercent =
    totals.savingsRate !== null
      ? (totals.savingsRate * 100).toFixed(1)
      : "—";
  const goalDelta =
    totals.savingsRate !== null
      ? totals.savingsRate - savingsGoalFraction
      : null;

  // Group spend by (categoryId, personTag) so per-person budgets reflect only
  // that person's contributions.
  const totalsByPerson = new Map(
    [null, ...Array.from(new Set(budgets.map((b) => b.personTag)))].map(
      (tag) => [
        tag,
        monthlyTotalsByCategory(txns as TxnRow[], {
          baseCurrency,
          kind: "EXPENSE",
          personTag: tag,
        }),
      ],
    ),
  );

  const prevKey = previousMonthRange(range).key;
  const nextKey = nextMonthRange(range).key;

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <PillTag>Budgets · {monthLabel}</PillTag>
            <h1 className="font-display-md mt-3 text-on-primary">
              Monthly caps
            </h1>
            <p className="font-body-md mt-1 text-on-primary/70">
              Per-category limits and the household savings goal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/budgets?month=${prevKey}`}
              className="rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
            >
              ← {prevKey}
            </Link>
            <Link
              href={`/dashboard/budgets?month=${nextKey}`}
              className="rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
            >
              {nextKey} →
            </Link>
          </div>
        </header>

        <Card
          variant="dashboardMockup"
          padding="md"
          className="bg-brand-dark-900/60 mb-6 text-on-primary"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="font-micro-cap text-on-primary/60">
                Savings this month
              </p>
              <Money
                value={totals.savings}
                tone={totals.savings.amountMinor < 0 ? "negative" : "neutral"}
                className="font-display-md mt-2 text-on-primary"
              />
              <p className="font-body-md mt-1 text-on-primary/70">
                {actualSavingsPercent}% of income
              </p>
            </div>
            <div>
              <p className="font-micro-cap text-on-primary/60">Goal</p>
              <p className="font-display-md mt-2 text-on-primary">
                {savingsGoalPercent}%
              </p>
              <SavingsGoalForm
                initialPercent={savingsGoalPercent}
                action={saveSavingsGoalAction}
              />
            </div>
            <div>
              <p className="font-micro-cap text-on-primary/60">vs. goal</p>
              <p
                className={
                  goalDelta === null
                    ? "font-display-md mt-2 text-on-primary"
                    : goalDelta >= 0
                      ? "font-display-md mt-2 text-primary-soft"
                      : "font-display-md mt-2 text-ruby"
                }
              >
                {goalDelta === null
                  ? "—"
                  : `${goalDelta >= 0 ? "+" : ""}${(goalDelta * 100).toFixed(1)}%`}
              </p>
              <p className="font-body-md mt-1 text-on-primary/70">
                {goalDelta === null
                  ? "No income recorded yet."
                  : goalDelta >= 0
                    ? "At or above the household target."
                    : "Below target — adjust spend or goal."}
              </p>
            </div>
          </div>
        </Card>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          <h2 className="font-heading-md mb-4 text-on-primary">
            Category budgets
          </h2>

          <div className="mb-6">
            <NewBudgetRowForm
              categories={categories}
              defaultPeriodStart={range.start.toISOString().slice(0, 10)}
              defaultCurrency={baseCurrency}
              action={createBudgetAction}
            />
          </div>

          {budgets.length === 0 ? (
            <p className="font-body-md text-on-primary/70">
              No budgets for {monthLabel} yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="font-body-md min-w-full text-left text-on-primary">
                <thead className="font-micro-cap text-on-primary/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Payer</th>
                    <th className="py-2 pr-4 text-right">Budget</th>
                    <th className="py-2 pr-4 text-right">Spent</th>
                    <th className="py-2 pr-4 text-right">Progress</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((b) => {
                    const personTotals =
                      totalsByPerson.get(b.personTag) ?? [];
                    const spentMinor = lookupCategorySpend(
                      personTotals,
                      b.categoryId,
                    );
                    const budgetMinor = Number(b.amountMinor);
                    const ratio =
                      budgetMinor === 0 ? 0 : spentMinor / budgetMinor;
                    const ratioPct = (ratio * 100).toFixed(0);
                    const digits = fractionDigitsForCurrency(b.currency);
                    const amountMajor = (
                      budgetMinor /
                      10 ** digits
                    ).toFixed(digits);
                    return (
                      <tr key={b.id} className="border-b border-white/5">
                        <td className="py-2 pr-4">
                          {b.category
                            ? `${b.category.name}${b.category.nameZh ? ` · ${b.category.nameZh}` : ""}`
                            : "Whole household"}
                        </td>
                        <td className="py-2 pr-4">{b.personTag ?? "All"}</td>
                        <td className="py-2 pr-4 text-right">
                          <EditBudgetRowForm
                            id={b.id}
                            amountMajor={amountMajor}
                            currency={b.currency}
                            action={updateBudgetAction}
                          />
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <Money
                            value={{
                              amountMinor: spentMinor,
                              currency: b.currency,
                            }}
                            className="text-on-primary"
                            tone={ratio > 1 ? "negative" : "neutral"}
                          />
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <ProgressBar ratio={ratio} />
                          <span className="font-micro-cap mt-1 block text-on-primary/60">
                            {ratioPct}%
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <form action={deleteBudgetAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="border border-white/15 text-on-primary/80 hover:bg-white/5 hover:text-on-primary"
                            >
                              Delete
                            </Button>
                          </form>
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

function ProgressBar({ ratio }: { ratio: number }) {
  const clamped = Math.max(0, Math.min(1.25, ratio));
  const widthPct = (clamped / 1.25) * 100;
  const over = ratio > 1;
  return (
    <div className="ml-auto h-2 w-32 overflow-hidden rounded-pill bg-white/10">
      <div
        className={over ? "h-full bg-ruby" : "h-full bg-primary-soft"}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  );
}

function safeMonthRange(key: string) {
  try {
    return monthRangeFromKey(key);
  } catch {
    return currentMonthRange();
  }
}
