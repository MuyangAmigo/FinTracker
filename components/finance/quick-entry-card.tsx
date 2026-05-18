"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { PillTag } from "@/components/ui/pill-tag";
import { cn } from "@/lib/utils";

import {
  TransactionForm,
  type AccountOption,
  type CategoryOption,
} from "./transaction-form";
import type { TransactionActionResult } from "@/app/dashboard/transactions/actions";

/*
 * Collapsible quick-entry card for the dashboard overview.
 *
 * Renders a tight, two-column variant of TransactionForm. Collapsed by
 * default so the dashboard hero remains tidy; the user expands when they
 * need to capture a transaction.
 */

export interface QuickEntryCardProps {
  action: (
    prev: TransactionActionResult | null,
    formData: FormData,
  ) => Promise<TransactionActionResult>;
  accounts: AccountOption[];
  categories: CategoryOption[];
  defaultPersonTag?: string;
  defaultCurrency?: string;
}

export function QuickEntryCard({
  action,
  accounts,
  categories,
  defaultPersonTag,
  defaultCurrency,
}: QuickEntryCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card
      variant="dashboardMockup"
      padding="md"
      className="bg-brand-dark-900/60 text-on-primary"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PillTag>Quick entry</PillTag>
          <h2 className="font-heading-md mt-2 text-on-primary">
            Capture a transaction
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="quick-entry-form"
          className="rounded-pill border border-white/15 px-4 py-1.5 font-button-sm text-on-primary/80 hover:bg-white/5 hover:text-on-primary"
        >
          {open ? "Hide form" : "Open form"}
        </button>
      </header>

      <div
        id="quick-entry-form"
        className={cn("transition-all", open ? "mt-5 block" : "hidden")}
      >
        <TransactionForm
          mode="create"
          action={action}
          accounts={accounts}
          categories={categories}
          compact
          defaults={{
            personTag: defaultPersonTag,
            currency: defaultCurrency,
          }}
        />
      </div>
    </Card>
  );
}
