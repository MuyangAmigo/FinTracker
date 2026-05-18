"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth/audit";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { getApiSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  createTransactionSchema,
  updateTransactionSchema,
} from "@/lib/validation/finance";

/*
 * Phase-5 transaction CRUD.
 *
 * Server actions: callable from client forms via useActionState. All writes
 * are validated through lib/validation/finance.ts and audited as
 * `finance.write`. Person-tag selection is sticky — the last value chosen
 * is written to a httpOnly cookie so the next visit pre-selects it.
 */

const HOUSEHOLD_ID = CURRENT_HOUSEHOLD_ID;
const PERSON_TAG_COOKIE = "fintracker.lastPersonTag";
const PERSON_TAG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type TransactionActionResult =
  | { ok: true; transactionId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function normaliseFormValue(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

async function rememberPersonTag(value: string | undefined): Promise<void> {
  if (!value) return;
  const jar = await cookies();
  jar.set(PERSON_TAG_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PERSON_TAG_COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function readLastPersonTag(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(PERSON_TAG_COOKIE)?.value;
}

function ensureSession(session: Awaited<ReturnType<typeof getApiSession>>) {
  if (!session?.user?.email) {
    throw new Error("unauthenticated");
  }
  return session;
}

export async function createTransactionAction(
  _prev: TransactionActionResult | null,
  formData: FormData,
): Promise<TransactionActionResult> {
  const session = await getApiSession();
  if (!session?.user?.email) {
    return { ok: false, error: "unauthenticated" };
  }

  const personTag = normaliseFormValue(formData.get("personTag"));

  const parsed = createTransactionSchema.safeParse({
    kind: normaliseFormValue(formData.get("kind")),
    scope: normaliseFormValue(formData.get("scope")) ?? "HOUSEHOLD",
    occurredOn: normaliseFormValue(formData.get("occurredOn")),
    money: {
      amountMajor: normaliseFormValue(formData.get("amountMajor")) ?? "",
      currency: normaliseFormValue(formData.get("currency")) ?? "CNY",
    },
    categoryId: normaliseFormValue(formData.get("categoryId")),
    accountId: normaliseFormValue(formData.get("accountId")),
    fromAccountId: normaliseFormValue(formData.get("fromAccountId")),
    toAccountId: normaliseFormValue(formData.get("toAccountId")),
    payee: normaliseFormValue(formData.get("payee")),
    note: normaliseFormValue(formData.get("note")),
    personTag,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const author = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });

  const created = await prisma.transaction.create({
    data: {
      householdId: HOUSEHOLD_ID,
      authorUserId: author?.id ?? null,
      kind: data.kind,
      scope: data.scope,
      occurredOn: data.occurredOn,
      amountMinor: BigInt(data.money.amountMinor),
      currency: data.money.currency,
      accountId: data.kind === "TRANSFER" ? null : (data.accountId ?? null),
      fromAccountId: data.kind === "TRANSFER" ? (data.fromAccountId ?? null) : null,
      toAccountId: data.kind === "TRANSFER" ? (data.toAccountId ?? null) : null,
      categoryId: data.categoryId ?? null,
      payee: data.payee ?? null,
      note: data.note ?? null,
      personTag: data.personTag ?? null,
    },
    select: { id: true },
  });

  await rememberPersonTag(data.personTag);

  audit({
    type: "finance.write",
    actor: session.user.email,
    householdId: HOUSEHOLD_ID,
    resource: created.id,
    metadata: {
      action: "transaction.create",
      kind: data.kind,
      amountMinor: data.money.amountMinor,
      currency: data.money.currency,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  return { ok: true, transactionId: created.id };
}

export async function updateTransactionAction(
  _prev: TransactionActionResult | null,
  formData: FormData,
): Promise<TransactionActionResult> {
  const session = await getApiSession();
  ensureSession(session);

  const id = normaliseFormValue(formData.get("id"));
  if (!id) return { ok: false, error: "Missing id" };

  const personTag = normaliseFormValue(formData.get("personTag"));

  const parsed = updateTransactionSchema.safeParse({
    id,
    kind: normaliseFormValue(formData.get("kind")),
    scope: normaliseFormValue(formData.get("scope")),
    occurredOn: normaliseFormValue(formData.get("occurredOn")),
    money:
      normaliseFormValue(formData.get("amountMajor")) !== undefined
        ? {
            amountMajor: normaliseFormValue(formData.get("amountMajor")) ?? "",
            currency: normaliseFormValue(formData.get("currency")) ?? "CNY",
          }
        : undefined,
    categoryId: normaliseFormValue(formData.get("categoryId")),
    accountId: normaliseFormValue(formData.get("accountId")),
    fromAccountId: normaliseFormValue(formData.get("fromAccountId")),
    toAccountId: normaliseFormValue(formData.get("toAccountId")),
    payee: normaliseFormValue(formData.get("payee")),
    note: normaliseFormValue(formData.get("note")),
    personTag,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, householdId: HOUSEHOLD_ID },
    select: { id: true, kind: true },
  });
  if (!existing) {
    return { ok: false, error: "Transaction not found" };
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.kind !== undefined) updateData.kind = data.kind;
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.occurredOn !== undefined) updateData.occurredOn = data.occurredOn;
  if (data.money !== undefined) {
    updateData.amountMinor = BigInt(data.money.amountMinor);
    updateData.currency = data.money.currency;
  }
  if (data.payee !== undefined) updateData.payee = data.payee;
  if (data.note !== undefined) updateData.note = data.note;
  if (data.personTag !== undefined) updateData.personTag = data.personTag;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;

  const effectiveKind = data.kind ?? existing.kind;
  if (effectiveKind === "TRANSFER") {
    updateData.accountId = null;
    if (data.fromAccountId !== undefined) updateData.fromAccountId = data.fromAccountId;
    if (data.toAccountId !== undefined) updateData.toAccountId = data.toAccountId;
  } else {
    if (data.accountId !== undefined) updateData.accountId = data.accountId;
    if (data.kind !== undefined && data.kind !== "TRANSFER") {
      updateData.fromAccountId = null;
      updateData.toAccountId = null;
    }
  }

  await prisma.transaction.update({ where: { id }, data: updateData });
  await rememberPersonTag(data.personTag ?? undefined);

  audit({
    type: "finance.write",
    actor: session!.user!.email!,
    householdId: HOUSEHOLD_ID,
    resource: id,
    metadata: { action: "transaction.update" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath(`/dashboard/transactions/${id}`);
  return { ok: true, transactionId: id };
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const session = await getApiSession();
  ensureSession(session);

  const id = normaliseFormValue(formData.get("id"));
  if (!id) return;

  const existing = await prisma.transaction.findFirst({
    where: { id, householdId: HOUSEHOLD_ID },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.transaction.delete({ where: { id } });

  audit({
    type: "finance.write",
    actor: session!.user!.email!,
    householdId: HOUSEHOLD_ID,
    resource: id,
    metadata: { action: "transaction.delete" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  redirect("/dashboard/transactions");
}

function flattenFieldErrors(
  error: { issues: { path: PropertyKey[]; message: string }[] },
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key =
      issue.path.map((p) => String(p)).join(".") || "_form";
    map[key] = map[key] ? [...map[key], issue.message] : [issue.message];
  }
  return map;
}
