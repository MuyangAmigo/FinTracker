import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PillTag } from "@/components/ui/pill-tag";
import { TransactionForm } from "@/components/finance/transaction-form";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  loadAccountOptions,
  loadCategoryOptions,
} from "@/lib/finance/reference-data";
import { toMajor } from "@/lib/money";

import {
  deleteTransactionAction,
  updateTransactionAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const [txn, accounts, categories] = await Promise.all([
    prisma.transaction.findFirst({
      where: { id, householdId: CURRENT_HOUSEHOLD_ID },
    }),
    loadAccountOptions(),
    loadCategoryOptions(),
  ]);
  if (!txn) notFound();

  const editableKind =
    txn.kind === "INCOME" || txn.kind === "EXPENSE" || txn.kind === "TRANSFER"
      ? txn.kind
      : "EXPENSE";

  const amountMajor = toMajor({
    amountMinor: Number(txn.amountMinor),
    currency: txn.currency,
  }).toString();

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard/transactions"
          className="font-micro-cap text-on-primary/60 hover:text-on-primary"
        >
          ← Back to transactions
        </Link>
        <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <PillTag>Edit transaction</PillTag>
            <h1 className="font-display-md mt-3 text-on-primary">
              {amountMajor} {txn.currency}
            </h1>
            <p className="font-body-md mt-1 text-on-primary/70">
              {txn.occurredOn.toISOString().slice(0, 10)} ·{" "}
              {txn.kind.toLowerCase()}
            </p>
          </div>
          <form action={deleteTransactionAction}>
            <input type="hidden" name="id" value={txn.id} />
            <Button
              variant="ghost"
              type="submit"
              className="border border-white/15 text-on-primary/80 hover:bg-white/5 hover:text-on-primary"
            >
              Delete
            </Button>
          </form>
        </header>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          <TransactionForm
            mode="edit"
            action={updateTransactionAction}
            accounts={accounts}
            categories={categories}
            defaults={{
              id: txn.id,
              kind: editableKind,
              occurredOn: txn.occurredOn.toISOString().slice(0, 10),
              amountMajor,
              currency: txn.currency,
              accountId: txn.accountId ?? undefined,
              fromAccountId: txn.fromAccountId ?? undefined,
              toAccountId: txn.toAccountId ?? undefined,
              categoryId: txn.categoryId ?? undefined,
              personTag: txn.personTag ?? undefined,
              payee: txn.payee ?? undefined,
              note: txn.note ?? undefined,
            }}
            successHref="/dashboard/transactions"
          />
        </Card>
      </div>
    </main>
  );
}
