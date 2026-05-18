"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TransactionActionResult } from "@/app/dashboard/transactions/actions";

/*
 * Quick-entry transaction form (Phase 5 primary surface).
 *
 * Three kinds — INCOME, EXPENSE, TRANSFER — toggle which account fields are
 * shown. Investment kinds are intentionally hidden from the UI until Phase 7;
 * the importer still uses them so the schema/data are preserved.
 *
 * PersonTag and currency are sticky-by-default but always editable.
 */

export interface AccountOption {
  id: string;
  name: string;
  kind: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  nameZh: string | null;
  kind: "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT" | "ADJUSTMENT";
}

export interface TransactionFormDefaults {
  id?: string;
  kind?: "INCOME" | "EXPENSE" | "TRANSFER";
  occurredOn?: string;
  amountMajor?: string;
  currency?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  categoryId?: string;
  personTag?: string;
  payee?: string;
  note?: string;
}

export interface TransactionFormProps {
  mode: "create" | "edit";
  action: (
    prev: TransactionActionResult | null,
    formData: FormData,
  ) => Promise<TransactionActionResult>;
  accounts: AccountOption[];
  categories: CategoryOption[];
  defaults?: TransactionFormDefaults;
  personTagOptions?: string[];
  successHref?: string;
  /** When true, render in a compact 2-column variant for the dashboard card. */
  compact?: boolean;
}

const KINDS: { value: "INCOME" | "EXPENSE" | "TRANSFER"; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
];

const DEFAULT_PERSON_TAGS = ["Junjie", "Jinyou", "Household"];

function todayIsoUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = now.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function TransactionForm({
  mode,
  action,
  accounts,
  categories,
  defaults,
  personTagOptions,
  successHref,
  compact,
}: TransactionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const reactId = useId();
  const formId = `txn-form-${defaults?.id ?? reactId}`;
  const [kind, setKind] = useState<"INCOME" | "EXPENSE" | "TRANSFER">(
    defaults?.kind ?? "EXPENSE",
  );

  const [state, formAction, submitting] = useActionState<
    TransactionActionResult | null,
    FormData
  >((prev, fd) => {
    return action(prev, fd).then((result) => {
      if (result.ok && successHref) {
        startTransition(() => {
          router.push(successHref);
          router.refresh();
        });
      } else if (result.ok && mode === "create") {
        // Reset everything except the sticky personTag + kind.
        const form = document.getElementById(
          formId,
        ) as HTMLFormElement | null;
        form?.reset();
        startTransition(() => router.refresh());
      }
      return result;
    });
  }, null);

  const categoryOptions =
    kind === "TRANSFER"
      ? ([] as CategoryOption[])
      : categories.filter(
          (c) => c.kind === (kind === "INCOME" ? "INCOME" : "EXPENSE"),
        );

  const personTagChoices = (() => {
    const set = new Set<string>(personTagOptions ?? DEFAULT_PERSON_TAGS);
    if (defaults?.personTag) set.add(defaults.personTag);
    return Array.from(set);
  })();

  const transferFields = kind === "TRANSFER";
  const isSubmitting = submitting || isPending;

  const errorMessage =
    state && !state.ok ? state.error : null;

  return (
    <form
      id={formId}
      action={formAction}
      className={cn("space-y-4 text-on-primary", compact && "space-y-3")}
    >
      {defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      <KindTabs value={kind} onChange={setKind} />
      <input type="hidden" name="kind" value={kind} />

      <div className={cn("grid gap-3", compact ? "md:grid-cols-2" : "md:grid-cols-3")}>
        <Field label="Date">
          <input
            type="date"
            name="occurredOn"
            defaultValue={defaults?.occurredOn ?? todayIsoUtc()}
            required
            className={fieldClass}
          />
        </Field>

        <Field label="Amount">
          <input
            type="text"
            inputMode="decimal"
            name="amountMajor"
            defaultValue={defaults?.amountMajor ?? ""}
            placeholder="0.00"
            required
            className={cn(fieldClass, "tabular-money")}
          />
        </Field>

        <Field label="Currency">
          <select
            name="currency"
            defaultValue={defaults?.currency ?? "CNY"}
            className={fieldClass}
          >
            {["CNY", "USD", "HKD", "EUR", "GBP", "JPY"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {transferFields ? (
        <div className={cn("grid gap-3", compact ? "md:grid-cols-2" : "md:grid-cols-2")}>
          <Field label="From account">
            <AccountSelect
              name="fromAccountId"
              accounts={accounts}
              defaultValue={defaults?.fromAccountId}
              required
            />
          </Field>
          <Field label="To account">
            <AccountSelect
              name="toAccountId"
              accounts={accounts}
              defaultValue={defaults?.toAccountId}
              required
            />
          </Field>
        </div>
      ) : (
        <div className={cn("grid gap-3", compact ? "md:grid-cols-2" : "md:grid-cols-2")}>
          <Field label="Account">
            <AccountSelect
              name="accountId"
              accounts={accounts}
              defaultValue={defaults?.accountId}
              required
            />
          </Field>
          <Field label="Category">
            <select
              name="categoryId"
              defaultValue={defaults?.categoryId ?? ""}
              className={fieldClass}
            >
              <option value="">— Uncategorised —</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.nameZh ? ` · ${c.nameZh}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className={cn("grid gap-3", compact ? "md:grid-cols-2" : "md:grid-cols-3")}>
        <Field label="Payer / scope">
          <select
            name="personTag"
            defaultValue={defaults?.personTag ?? personTagChoices[2] ?? "Household"}
            className={fieldClass}
          >
            {personTagChoices.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Payee (optional)" className={compact ? "" : "md:col-span-2"}>
          <input
            type="text"
            name="payee"
            defaultValue={defaults?.payee ?? ""}
            placeholder="Where did it happen?"
            className={fieldClass}
          />
        </Field>
      </div>

      <Field label="Note (optional)">
        <textarea
          name="note"
          defaultValue={defaults?.note ?? ""}
          rows={compact ? 2 : 3}
          className={cn(fieldClass, "resize-y")}
        />
      </Field>

      {errorMessage ? (
        <p role="alert" className="font-body-md text-ruby">
          {errorMessage}
        </p>
      ) : state?.ok && mode === "create" && !successHref ? (
        <p role="status" className="font-body-md text-primary-soft">
          Saved.
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <Button variant="onDark" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving…"
            : mode === "create"
              ? "Add transaction"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function KindTabs({
  value,
  onChange,
}: {
  value: "INCOME" | "EXPENSE" | "TRANSFER";
  onChange: (v: "INCOME" | "EXPENSE" | "TRANSFER") => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Transaction kind"
      className="inline-flex rounded-pill border border-white/10 bg-white/5 p-1"
    >
      {KINDS.map((k) => (
        <button
          key={k.value}
          type="button"
          role="tab"
          aria-selected={value === k.value}
          onClick={() => onChange(k.value)}
          className={cn(
            "rounded-pill px-4 py-1.5 font-button-sm transition-colors",
            value === k.value
              ? "bg-primary text-on-primary"
              : "text-on-primary/70 hover:text-on-primary",
          )}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}

function AccountSelect({
  name,
  accounts,
  defaultValue,
  required,
}: {
  name: string;
  accounts: AccountOption[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
      className={fieldClass}
    >
      <option value="">— Select account —</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="font-micro-cap text-on-primary/60">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const fieldClass =
  "block w-full rounded-md border border-white/10 bg-canvas/5 px-3 py-2 font-body-md text-on-primary placeholder:text-on-primary/40 focus:border-primary-soft focus:outline-none";
