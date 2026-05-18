"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/auth/audit";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { getApiSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { monthRangeFromKey } from "@/lib/finance/period";
import { fromMajor } from "@/lib/money";

/*
 * Phase-5 account snapshot writes.
 *
 * `saveSnapshotsAction` takes one numeric input per active account and
 * upserts the (account, month-end) row. Rows submitted empty are skipped —
 * the existing snapshot (if any) is left untouched. We log a single
 * batch-summary audit event rather than one event per account.
 */

export type SnapshotActionResult =
  | { ok: true; saved: number; skipped: number; month: string }
  | { ok: false; error: string };

export async function saveSnapshotsAction(
  _prev: SnapshotActionResult | null,
  formData: FormData,
): Promise<SnapshotActionResult> {
  const session = await getApiSession();
  if (!session?.user?.email) {
    return { ok: false, error: "unauthenticated" };
  }

  const monthKey = (formData.get("month") as string | null)?.trim();
  if (!monthKey) {
    return { ok: false, error: "Missing month" };
  }

  let range;
  try {
    range = monthRangeFromKey(monthKey);
  } catch {
    return { ok: false, error: `Invalid month "${monthKey}"` };
  }

  // Load active accounts so we only accept inputs for legitimate ids.
  const accounts = await prisma.account.findMany({
    where: { householdId: CURRENT_HOUSEHOLD_ID, archivedAt: null },
    select: { id: true, currency: true },
  });
  const accountIndex = new Map(accounts.map((a) => [a.id, a]));

  let saved = 0;
  let skipped = 0;

  for (const account of accounts) {
    const raw = formData.get(`balance.${account.id}`);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value === "") {
      skipped += 1;
      continue;
    }
    if (!/^-?\d+(\.\d+)?$/.test(value)) {
      return {
        ok: false,
        error: `Invalid number "${value}" for an account`,
      };
    }
    const money = fromMajor(parseFloat(value), account.currency);

    await prisma.accountSnapshot.upsert({
      where: { accountId_asOf: { accountId: account.id, asOf: range.end } },
      update: {
        balanceMinor: BigInt(money.amountMinor),
        currency: money.currency,
      },
      create: {
        householdId: CURRENT_HOUSEHOLD_ID,
        accountId: account.id,
        asOf: range.end,
        balanceMinor: BigInt(money.amountMinor),
        currency: money.currency,
      },
    });
    saved += 1;
  }

  void accountIndex; // silence unused (kept for symmetry with validation)

  audit({
    type: "finance.write",
    actor: session.user.email,
    householdId: CURRENT_HOUSEHOLD_ID,
    metadata: {
      action: "snapshot.batch",
      month: range.key,
      saved,
      skipped,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/snapshots");
  return { ok: true, saved, skipped, month: range.key };
}
