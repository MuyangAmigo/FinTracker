import { prisma } from "@/lib/db";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";

import type {
  AccountOption,
  CategoryOption,
} from "@/components/finance/transaction-form";

/*
 * Reference-data loaders shared across Phase-5 surfaces. Kept in one place
 * so all forms see the same household-scoped option lists and any caching /
 * filtering policy lives in a single file.
 */

export async function loadAccountOptions(): Promise<AccountOption[]> {
  const accounts = await prisma.account.findMany({
    where: { householdId: CURRENT_HOUSEHOLD_ID, archivedAt: null },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: { id: true, name: true, kind: true },
  });
  return accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }));
}

export async function loadCategoryOptions(): Promise<CategoryOption[]> {
  const categories = await prisma.category.findMany({
    where: { householdId: CURRENT_HOUSEHOLD_ID, isArchived: false },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: { id: true, name: true, nameZh: true, kind: true },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    nameZh: c.nameZh,
    kind: c.kind,
  }));
}

export async function loadHouseholdCurrency(): Promise<string> {
  const household = await prisma.household.findUnique({
    where: { id: CURRENT_HOUSEHOLD_ID },
    select: { baseCurrency: true },
  });
  return household?.baseCurrency ?? "CNY";
}
