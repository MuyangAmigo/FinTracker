"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/auth/audit";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { getApiSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { createBudgetSchema } from "@/lib/validation/finance";

/*
 * Phase-5 budget management.
 *
 * MONTHLY-only in the UI; the schema retains ANNUAL for future use.
 * Person-tag is optional — null means the budget applies household-wide.
 *
 * The household savings-goal rate lives on `Household.savingsGoalRate` and is
 * edited from the same surface (a single decimal slider / input). We persist
 * it as a fraction (0..1) so display math stays simple.
 */

export type BudgetActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type GoalActionResult =
  | { ok: true; rate: number }
  | { ok: false; error: string };

function normalise(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function createBudgetAction(
  _prev: BudgetActionResult | null,
  formData: FormData,
): Promise<BudgetActionResult> {
  const session = await getApiSession();
  if (!session?.user?.email) return { ok: false, error: "unauthenticated" };

  const parsed = createBudgetSchema.safeParse({
    categoryId: normalise(formData.get("categoryId")),
    period: normalise(formData.get("period")) ?? "MONTHLY",
    periodStart: normalise(formData.get("periodStart")),
    money: {
      amountMajor: normalise(formData.get("amountMajor")) ?? "",
      currency: normalise(formData.get("currency")) ?? "CNY",
    },
    personTag: normalise(formData.get("personTag")),
    note: normalise(formData.get("note")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
    };
  }
  const data = parsed.data;

  try {
    const created = await prisma.budget.create({
      data: {
        householdId: CURRENT_HOUSEHOLD_ID,
        categoryId: data.categoryId ?? null,
        period: data.period,
        periodStart: data.periodStart,
        amountMinor: BigInt(data.money.amountMinor),
        currency: data.money.currency,
        personTag: data.personTag ?? null,
        note: data.note ?? null,
      },
      select: { id: true },
    });

    audit({
      type: "finance.write",
      actor: session.user.email,
      householdId: CURRENT_HOUSEHOLD_ID,
      resource: created.id,
      metadata: {
        action: "budget.create",
        period: data.period,
        amountMinor: data.money.amountMinor,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budgets");
    return { ok: true, id: created.id };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        ok: false,
        error: "A budget for this category, period and payer already exists",
      };
    }
    throw err;
  }
}

const updateSchema = z.object({
  id: z.string().cuid(),
  amountMajor: z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, "Amount must be a decimal number"),
  currency: z.string().regex(/^[A-Z]{3}$/, "ISO 4217 code"),
  note: z.string().max(2000).optional(),
});

export async function updateBudgetAction(
  _prev: BudgetActionResult | null,
  formData: FormData,
): Promise<BudgetActionResult> {
  const session = await getApiSession();
  if (!session?.user?.email) return { ok: false, error: "unauthenticated" };

  const parsed = updateSchema.safeParse({
    id: normalise(formData.get("id")),
    amountMajor: normalise(formData.get("amountMajor")),
    currency: normalise(formData.get("currency")) ?? "CNY",
    note: normalise(formData.get("note")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
    };
  }
  const { id, amountMajor, currency, note } = parsed.data;

  const existing = await prisma.budget.findFirst({
    where: { id, householdId: CURRENT_HOUSEHOLD_ID },
    select: { id: true, currency: true },
  });
  if (!existing) return { ok: false, error: "Budget not found" };

  const digits = currency === "JPY" || currency === "KRW" ? 0 : 2;
  const minor = Math.round(parseFloat(amountMajor) * 10 ** digits);

  await prisma.budget.update({
    where: { id },
    data: {
      amountMinor: BigInt(minor),
      currency,
      note: note ?? null,
    },
  });

  audit({
    type: "finance.write",
    actor: session.user.email,
    householdId: CURRENT_HOUSEHOLD_ID,
    resource: id,
    metadata: { action: "budget.update", amountMinor: minor, currency },
  });

  revalidatePath("/dashboard/budgets");
  return { ok: true, id };
}

export async function deleteBudgetAction(formData: FormData): Promise<void> {
  const session = await getApiSession();
  if (!session?.user?.email) return;

  const id = normalise(formData.get("id"));
  if (!id) return;

  const existing = await prisma.budget.findFirst({
    where: { id, householdId: CURRENT_HOUSEHOLD_ID },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.budget.delete({ where: { id } });

  audit({
    type: "finance.write",
    actor: session.user.email,
    householdId: CURRENT_HOUSEHOLD_ID,
    resource: id,
    metadata: { action: "budget.delete" },
  });

  revalidatePath("/dashboard/budgets");
}

const goalSchema = z.object({
  ratePercent: z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, "Goal must be a percentage")
    .transform((s) => parseFloat(s))
    .refine((n) => n >= 0 && n <= 100, {
      message: "Goal must be between 0 and 100",
    }),
});

export async function saveSavingsGoalAction(
  _prev: GoalActionResult | null,
  formData: FormData,
): Promise<GoalActionResult> {
  const session = await getApiSession();
  if (!session?.user?.email) return { ok: false, error: "unauthenticated" };

  const parsed = goalSchema.safeParse({
    ratePercent: normalise(formData.get("ratePercent")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
    };
  }
  const fraction = parsed.data.ratePercent / 100;

  await prisma.household.update({
    where: { id: CURRENT_HOUSEHOLD_ID },
    data: { savingsGoalRate: fraction },
  });

  audit({
    type: "admin.settings",
    actor: session.user.email,
    householdId: CURRENT_HOUSEHOLD_ID,
    metadata: { action: "savings_goal.update", rate: fraction },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/budgets");
  return { ok: true, rate: fraction };
}
