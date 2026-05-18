"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SnapshotActionResult } from "@/app/dashboard/snapshots/actions";

/*
 * Editable balance grid for monthly account snapshots.
 *
 * One row per active account. Each row's input is pre-filled with the most
 * recent snapshot value (or blank if none). "Save all" submits the batch
 * via a single server action — empty inputs are skipped server-side.
 */

export interface SnapshotRow {
  accountId: string;
  accountName: string;
  accountKind: string;
  currency: string;
  /** Major-unit string from the most recent snapshot, or empty when none. */
  initialValue: string;
  /** ISO date of the snapshot that supplied initialValue, or null. */
  asOf: string | null;
}

export interface SnapshotGridProps {
  monthKey: string;
  rows: SnapshotRow[];
  action: (
    prev: SnapshotActionResult | null,
    formData: FormData,
  ) => Promise<SnapshotActionResult>;
}

const KIND_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank",
  WALLET: "Wallet",
  CREDIT_CARD: "Credit card",
  BROKERAGE: "Brokerage",
  ESPP: "ESPP",
  INSURANCE: "Insurance",
  INVESTMENT: "Investment",
  LIABILITY: "Liability",
  OTHER: "Other",
};

export function SnapshotGrid({ monthKey, rows, action }: SnapshotGridProps) {
  const [state, formAction, submitting] = useActionState<
    SnapshotActionResult | null,
    FormData
  >((prev, fd) => action(prev, fd), null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="month" value={monthKey} />

      <div className="overflow-x-auto">
        <table className="font-body-md min-w-full text-left text-on-primary">
          <thead className="font-micro-cap text-on-primary/60">
            <tr className="border-b border-white/10">
              <th className="py-2 pr-4">Account</th>
              <th className="py-2 pr-4">Kind</th>
              <th className="py-2 pr-4">Currency</th>
              <th className="py-2 pr-4 text-right">Balance (month-end)</th>
              <th className="py-2 pr-4 text-right">Previous</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SnapshotInputRow key={row.accountId} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button variant="onDark" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save snapshots"}
        </Button>
        {state?.ok ? (
          <p className="font-body-md text-primary-soft" role="status">
            Saved {state.saved} · skipped {state.skipped}
          </p>
        ) : null}
        {state && !state.ok ? (
          <p className="font-body-md text-ruby" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function SnapshotInputRow({ row }: { row: SnapshotRow }) {
  const [value, setValue] = useState(row.initialValue);
  const dirty = value !== row.initialValue;
  return (
    <tr className="border-b border-white/5">
      <td className="py-2 pr-4 text-on-primary">{row.accountName}</td>
      <td className="font-micro-cap py-2 pr-4 text-on-primary/70">
        {KIND_LABEL[row.accountKind] ?? row.accountKind}
      </td>
      <td className="py-2 pr-4 text-on-primary/80">{row.currency}</td>
      <td className="py-2 pr-4 text-right">
        <input
          type="text"
          inputMode="decimal"
          name={`balance.${row.accountId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="—"
          className={cn(
            "tabular-money w-40 rounded-md border border-white/10 bg-canvas/5 px-3 py-1.5 text-right text-on-primary placeholder:text-on-primary/40 focus:border-primary-soft focus:outline-none",
            dirty && "border-primary-soft",
          )}
        />
      </td>
      <td className="py-2 pr-4 text-right text-on-primary/60">
        {row.asOf ? `as of ${row.asOf}` : "no prior snapshot"}
      </td>
    </tr>
  );
}
