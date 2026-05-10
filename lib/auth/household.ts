import { prisma } from "@/lib/db";
import { householdRoleFor } from "@/lib/auth/allowlist";

/*
 * Household synchronization on first sign-in.
 *
 * Phase 3 wires Auth.js to the database. The first time a user signs in we:
 *   1. Upsert a User row keyed by email (and Entra OID if available).
 *   2. Make sure the canonical household exists.
 *   3. Add the user as an OWNER or MEMBER based on the env allowlist.
 *
 * The env allowlist remains the source of truth for "who is allowed at all"
 * and "who is owner". Phase 5 adds an admin UI to invite members from the DB
 * directly; until then this keeps zero-config bootstrapping working.
 */

const HOUSEHOLD_ID = "junyou-household";
const HOUSEHOLD_NAME = process.env.HOUSEHOLD_NAME ?? "Household";

export async function syncUserAndHousehold(input: {
  email: string;
  name?: string | null;
  entraOid?: string | null;
}) {
  const email = input.email.toLowerCase();
  const dbRole = householdRoleFor(email) === "owner" ? "OWNER" : "MEMBER";

  return prisma.$transaction(async (tx) => {
    const household = await tx.household.upsert({
      where: { id: HOUSEHOLD_ID },
      create: {
        id: HOUSEHOLD_ID,
        name: HOUSEHOLD_NAME,
        baseCurrency: "CNY",
        savingsGoalRate: 0.6,
      },
      update: {},
    });

    const user = await tx.user.upsert({
      where: { email },
      create: {
        email,
        name: input.name ?? null,
        entraOid: input.entraOid ?? null,
      },
      update: {
        name: input.name ?? undefined,
        entraOid: input.entraOid ?? undefined,
      },
    });

    await tx.householdMembership.upsert({
      where: {
        householdId_userId: { householdId: household.id, userId: user.id },
      },
      create: {
        householdId: household.id,
        userId: user.id,
        role: dbRole,
        status: "ACTIVE",
        displayName: input.name ?? email.split("@")[0],
      },
      update: {
        role: dbRole,
        status: "ACTIVE",
      },
    });

    return { household, user };
  });
}
