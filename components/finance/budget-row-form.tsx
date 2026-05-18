"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type {
  BudgetActionResult,
  GoalActionResult,
} from "@/app/dashboard/budgets/actions";

/*
 * Inline budget editor — used in both "add" and "edit" modes.
 *
 * Add mode renders a row of inputs at the top of the budgets table.
 * Edit mode shows a compact amount input that swaps in for the displayed
 * row when the user clicks "Edit".
 */

const PERSON_TAG_DEFAULTS = ["", "Junjie", "Jinyou", "Household"];

export interface BudgetCategoryOption {
  id: string;
  name: string;
  nameZh: string | null;
}

export interface NewBudgetRowFormProps {
  categories: BudgetCategoryOption[];
  defaultPeriodStart: string;
  defaultCurrency: string;
  action: (
    prev: BudgetActionResult | null,
    formData: FormData,
  ) => Promise<BudgetActionResult>;
}

export function NewBudgetRowForm({
  categories,
  defaultPeriodStart,
  defaultCurrency,
  action,
}: NewBudgetRowFormProps) {
  const [state, formAction, pending] = useActionState<
    BudgetActionResult | null,
    FormData
  >((prev, fd) => action(prev, fd), null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <select
          name="categoryId"
          defaultValue=""
          className={fieldClass}
          required
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.nameZh ? ` · ${c.nameZh}` : ""}
            </option>
          ))}
        </select>
        <select name="personTag" defaultValue="" className={fieldClass}>
          {PERSON_TAG_DEFAULTS.map((p) => (
            <option key={p} value={p}>
              {p === "" ? "Whole household" : p}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="decimal"
          name="amountMajor"
          placeholder="Budget amount"
          required
          className={cn(fieldClass, "tabular-money")}
        />
        <select
          name="currency"
          defaultValue={defaultCurrency}
          className={fieldClass}
        >
          {["CNY", "USD", "HKD", "EUR", "GBP", "JPY"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button variant="onDark" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add budget"}
        </Button>
      </div>
      <input type="hidden" name="period" value="MONTHLY" />
      <input type="hidden" name="periodStart" value={defaultPeriodStart} />
      {state && !state.ok ? (
        <p className="font-body-md text-ruby" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export interface EditBudgetRowFormProps {
  id: string;
  amountMajor: string;
  currency: string;
  action: (
    prev: BudgetActionResult | null,
    formData: FormData,
  ) => Promise<BudgetActionResult>;
}

export function EditBudgetRowForm({
  id,
  amountMajor,
  currency,
  action,
}: EditBudgetRowFormProps) {
  const [, formAction, pending] = useActionState<
    BudgetActionResult | null,
    FormData
  >((prev, fd) => action(prev, fd), null);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        type="text"
        name="amountMajor"
        defaultValue={amountMajor}
        inputMode="decimal"
        className={cn(fieldClass, "tabular-money w-32 text-right")}
      />
      <input
        type="hidden"
        name="currency"
        value={currency}
      />
      <Button variant="onDark" type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Save"}
      </Button>
    </form>
  );
}

export interface SavingsGoalFormProps {
  initialPercent: string;
  action: (
    prev: GoalActionResult | null,
    formData: FormData,
  ) => Promise<GoalActionResult>;
}

export function SavingsGoalForm({
  initialPercent,
  action,
}: SavingsGoalFormProps) {
  const [value, setValue] = useState(initialPercent);
  const [state, formAction, pending] = useActionState<
    GoalActionResult | null,
    FormData
  >((prev, fd) => action(prev, fd), null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        name="ratePercent"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(fieldClass, "tabular-money w-24 text-right")}
      />
      <span className="font-body-md text-on-primary/70">%</span>
      <Button variant="onDark" type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save goal"}
      </Button>
      {state?.ok ? (
        <span className="font-body-md text-primary-soft">Saved.</span>
      ) : null}
      {state && !state.ok ? (
        <span className="font-body-md text-ruby">{state.error}</span>
      ) : null}
    </form>
  );
}

const fieldClass =
  "block w-full rounded-md border border-white/10 bg-canvas/5 px-3 py-2 font-body-md text-on-primary placeholder:text-on-primary/40 focus:border-primary-soft focus:outline-none";
