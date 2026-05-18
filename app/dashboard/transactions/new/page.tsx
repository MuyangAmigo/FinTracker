import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PillTag } from "@/components/ui/pill-tag";
import { TransactionForm } from "@/components/finance/transaction-form";
import { requireSession } from "@/lib/auth/session";
import {
  loadAccountOptions,
  loadCategoryOptions,
  loadHouseholdCurrency,
} from "@/lib/finance/reference-data";

import {
  createTransactionAction,
  readLastPersonTag,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage() {
  await requireSession();

  const [accounts, categories, currency, lastPersonTag] = await Promise.all([
    loadAccountOptions(),
    loadCategoryOptions(),
    loadHouseholdCurrency(),
    readLastPersonTag(),
  ]);

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard/transactions"
          className="font-micro-cap text-on-primary/60 hover:text-on-primary"
        >
          ← Back to transactions
        </Link>
        <header className="mt-3 mb-6">
          <PillTag>New transaction</PillTag>
          <h1 className="font-display-md mt-3 text-on-primary">Add a transaction</h1>
          <p className="font-body-md mt-1 text-on-primary/70">
            Income, expense, or transfer between accounts.
          </p>
        </header>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          <TransactionForm
            mode="create"
            action={createTransactionAction}
            accounts={accounts}
            categories={categories}
            defaults={{ currency, personTag: lastPersonTag }}
            successHref="/dashboard/transactions"
          />
        </Card>
      </div>
    </main>
  );
}
