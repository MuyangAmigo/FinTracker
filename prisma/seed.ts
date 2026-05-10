import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db";

/*
 * Seed script — establishes the canonical household, both members, and the
 * baseline category set with bilingual labels and aliases drawn from the
 * existing spreadsheets in assets/csv-record-tracker/.
 *
 * Idempotent: re-running this script is safe. It uses upsert everywhere and
 * never deletes user-authored records.
 *
 * Run with:  pnpm db:seed
 */

const HOUSEHOLD_ID = "junyou-household";

type CategorySeed = {
  slug: string;
  name: string;
  nameZh?: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT" | "ADJUSTMENT";
  // Spreadsheet labels that should resolve to this category on import.
  aliases?: { label: string; personScope?: string }[];
};

const CATEGORIES: CategorySeed[] = [
  // -- Income ---------------------------------------------------------------
  {
    slug: "salary",
    name: "Salary",
    nameZh: "工资",
    kind: "INCOME",
    aliases: [
      { label: "Salary - Junjie", personScope: "Junjie" },
      { label: "Salary - Jinyou", personScope: "Jinyou" },
      { label: "工资", personScope: undefined },
    ],
  },
  {
    slug: "equity",
    name: "Equity / RSU",
    nameZh: "股权",
    kind: "INCOME",
    aliases: [
      { label: "Stock Vested", personScope: "Junjie" },
      { label: "RSU", personScope: undefined },
    ],
  },
  {
    slug: "other-income",
    name: "Other income",
    nameZh: "其他收入",
    kind: "INCOME",
    aliases: [{ label: "Other Income", personScope: undefined }],
  },

  // -- Expense (household / shared) -----------------------------------------
  { slug: "housing", name: "Housing", nameZh: "房租房贷", kind: "EXPENSE" },
  { slug: "utilities", name: "Utilities", nameZh: "水电煤", kind: "EXPENSE" },
  { slug: "groceries", name: "Groceries", nameZh: "买菜", kind: "EXPENSE" },
  {
    slug: "lifestyle",
    name: "Lifestyle / Fun",
    nameZh: "玩乐金",
    kind: "EXPENSE",
    aliases: [{ label: "玩乐金", personScope: undefined }],
  },
  {
    slug: "couple-fund",
    name: "Couple fund",
    nameZh: "恋爱金",
    kind: "EXPENSE",
    aliases: [{ label: "恋爱金", personScope: undefined }],
  },
  {
    slug: "splurge",
    name: "Splurge / Big-ticket",
    nameZh: "冤大头",
    kind: "EXPENSE",
    aliases: [{ label: "冤大头", personScope: undefined }],
  },
  { slug: "dining", name: "Dining out", nameZh: "外食", kind: "EXPENSE" },
  { slug: "transport", name: "Transport", nameZh: "交通", kind: "EXPENSE" },
  { slug: "travel", name: "Travel", nameZh: "旅游", kind: "EXPENSE" },
  { slug: "health", name: "Health & medical", nameZh: "医疗", kind: "EXPENSE" },
  {
    slug: "subscriptions",
    name: "Subscriptions",
    nameZh: "订阅",
    kind: "EXPENSE",
  },
  { slug: "gifts", name: "Gifts", nameZh: "礼物", kind: "EXPENSE" },
  { slug: "tax", name: "Tax", nameZh: "税", kind: "EXPENSE" },
  { slug: "other-expense", name: "Other expense", nameZh: "其他支出", kind: "EXPENSE" },

  // -- Transfer / Investment ------------------------------------------------
  { slug: "transfer", name: "Transfer", kind: "TRANSFER" },
  { slug: "savings", name: "Savings transfer", kind: "TRANSFER" },
  { slug: "investment-buy", name: "Investment contribution", kind: "INVESTMENT" },
  { slug: "investment-sell", name: "Investment withdrawal", kind: "INVESTMENT" },
  { slug: "espp", name: "ESPP", kind: "INVESTMENT" },
  { slug: "insurance-premium", name: "Insurance premium", kind: "INVESTMENT" },
];

async function seedCategories(client: PrismaClient | Prisma.TransactionClient) {
  for (const seed of CATEGORIES) {
    const category = await client.category.upsert({
      where: {
        householdId_slug: { householdId: HOUSEHOLD_ID, slug: seed.slug },
      },
      create: {
        householdId: HOUSEHOLD_ID,
        slug: seed.slug,
        name: seed.name,
        nameZh: seed.nameZh ?? null,
        kind: seed.kind,
      },
      update: {
        name: seed.name,
        nameZh: seed.nameZh ?? null,
        kind: seed.kind,
      },
    });

    for (const alias of seed.aliases ?? []) {
      const personScope = alias.personScope ?? null;
      // Compound unique key contains a nullable column. Postgres treats NULLs as
      // distinct, so the upsert isn't strictly idempotent on null personScope —
      // we mitigate by checking for an existing row first.
      const existing = await client.categoryAlias.findFirst({
        where: {
          householdId: HOUSEHOLD_ID,
          label: alias.label,
          personScope,
        },
      });
      if (existing) {
        await client.categoryAlias.update({
          where: { id: existing.id },
          data: { categoryId: category.id },
        });
      } else {
        await client.categoryAlias.create({
          data: {
            householdId: HOUSEHOLD_ID,
            categoryId: category.id,
            label: alias.label,
            personScope,
          },
        });
      }
    }
  }
}

async function seedHousehold(client: PrismaClient | Prisma.TransactionClient) {
  await client.household.upsert({
    where: { id: HOUSEHOLD_ID },
    create: {
      id: HOUSEHOLD_ID,
      name: process.env.HOUSEHOLD_NAME ?? "Household",
      baseCurrency: "CNY",
      savingsGoalRate: 0.6,
    },
    update: {},
  });
}

async function seedAccounts(client: PrismaClient | Prisma.TransactionClient) {
  // Account names mirror the columns observed in the personal-overview CSVs.
  // Owner association happens later when a real user is linked.
  const accounts = [
    { name: "Alipay", kind: "WALLET" as const },
    { name: "WeChat", kind: "WALLET" as const },
    { name: "CMB · 招商银行", kind: "BANK" as const },
    { name: "China Bank · 中行", kind: "BANK" as const },
    { name: "ICBC · 工行", kind: "BANK" as const },
    { name: "CITIC Saving · 中信", kind: "BANK" as const },
    { name: "CITIC Cash · 中信", kind: "BANK" as const },
    { name: "CITIC Wealth · 中信", kind: "BANK" as const },
    { name: "HSBC", kind: "BANK" as const },
    { name: "WeBank · 微众", kind: "BANK" as const },
    { name: "ESPP", kind: "ESPP" as const },
    { name: "Stock", kind: "BROKERAGE" as const },
    { name: "Life Insurance", kind: "INSURANCE" as const },
    { name: "Investment · misc", kind: "INVESTMENT" as const },
  ];

  for (const acc of accounts) {
    await client.account.upsert({
      where: {
        householdId_name: { householdId: HOUSEHOLD_ID, name: acc.name },
      },
      create: {
        householdId: HOUSEHOLD_ID,
        name: acc.name,
        kind: acc.kind,
        currency: "CNY",
      },
      update: { kind: acc.kind },
    });
  }
}

async function main() {
  // Each phase is idempotent, so we don't need a single wrapping transaction.
  // Doing so would exceed Prisma's default 5 s window on a remote DB like Neon.
  await seedHousehold(prisma);
  await seedCategories(prisma);
  await seedAccounts(prisma);
  console.log("✔ Seed complete");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
