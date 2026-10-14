import { Prisma, PrismaClient } from "@prisma/client";
import {
  accountInput,
  balanceInput,
  lineInput,
  monthInput,
  monthSchema,
  monthEnd,
  csv,
  decimal,
  parseMoney,
} from "../../shared/finance.js";
import { HttpError, type Identity } from "./auth.js";

export const db = new PrismaClient();
export const householdId = () => process.env.HOUSEHOLD_ID ?? "household";
async function lockAccounts(
  tx: Prisma.TransactionClient,
  household: string,
  ids: string[],
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Account" WHERE "householdId" = ${household} AND "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`,
  );
}
export async function bootstrap(client: PrismaClient, household: string) {
  const [people, accounts, lines, periods, entries, balances, references] =
    await Promise.all([
      client.person.findMany({
        where: { householdId: household },
        orderBy: { name: "asc" },
      }),
      client.account.findMany({
        where: { householdId: household },
        orderBy: { name: "asc" },
      }),
      client.ledgerLine.findMany({
        where: { householdId: household },
        orderBy: { name: "asc" },
      }),
      client.monthPeriod.findMany({
        where: { householdId: household },
        orderBy: { month: "asc" },
      }),
      client.monthlyEntry.findMany({ where: { householdId: household } }),
      client.assetBalance.findMany({
        where: { householdId: household },
        orderBy: { asOf: "asc" },
      }),
      client.sourceReference.findMany({ where: { householdId: household } }),
    ]);
  return { people, accounts, lines, periods, entries, balances, references };
}
async function validOwner(ownerId: string | null, household: string) {
  if (
    ownerId &&
    !(await db.person.findFirst({ where: { id: ownerId, householdId: household } }))
  )
    throw new HttpError(400, "归属人不存在");
}
export async function execute(
  resource: string,
  id: string | undefined,
  method: string,
  body: unknown,
  identity: Identity,
) {
  const household = householdId();
  if (
    !(await db.person.findFirst({
      where: { id: identity.personId, householdId: household },
    }))
  )
    throw new HttpError(403, "家庭成员配置不存在");
  const author = `${identity.tenantId}:${identity.objectId}`;
  if (resource === "bootstrap" && method === "GET") return bootstrap(db, household);
  if (resource === "accounts" && (method === "POST" || method === "PUT")) {
    const value = accountInput.parse(body);
    await validOwner(value.ownerId, household);
    return db.$transaction(async (tx) => {
      let account;
      const { version, ...metadata } = value;
      if (method === "PUT") {
        if (!id || version === undefined) throw new HttpError(400, "缺少账户版本");
        await lockAccounts(tx, household, [id]);
        if (
          !metadata.assetEnabled &&
          (await tx.assetBalance.count({
            where: { householdId: household, accountId: id },
          }))
        )
          throw new HttpError(
            400,
            "此账户有资产历史，不能取消资产用途；请归档并保留历史",
          );
        const result = await tx.account.updateMany({
          where: { id, householdId: household, version },
          data: { ...metadata, version: { increment: 1 } },
        });
        if (!result.count) throw new HttpError(409, "账户已被修改，请刷新后重试");
        account = await tx.account.findUniqueOrThrow({ where: { id } });
      } else
        account = await tx.account.create({
          data: { ...metadata, householdId: household },
        });
      if (
        account.expenseEnabled ||
        (await tx.ledgerLine.findUnique({ where: { accountId: account.id } }))
      ) {
        await tx.ledgerLine.upsert({
          where: { accountId: account.id },
          create: {
            householdId: household,
            accountId: account.id,
            name: account.name,
            kind: "EXPENSE",
            ownerId: account.ownerId,
            archived: account.archived || !account.expenseEnabled,
          },
          update: {
            name: account.name,
            ownerId: account.ownerId,
            archived: account.archived || !account.expenseEnabled,
          },
        });
      }
      return account;
    });
  }
  if (resource === "sources" && method === "POST") {
    const value = lineInput.parse(body);
    await validOwner(value.ownerId, household);
    return db.ledgerLine.create({
      data: { ...value, householdId: household, kind: "INCOME" },
    });
  }
  if (resource === "months" && method === "PUT") {
    const month = monthSchema.parse(id),
      value = monthInput.parse(body);
    const lines = await db.ledgerLine.findMany({
      where: { householdId: household, id: { in: value.entries.map((e) => e.lineId) } },
    });
    if (lines.length !== value.entries.length) throw new HttpError(400, "记账行不存在");
    return db.$transaction(
      async (tx) => {
        await tx.monthPeriod.upsert({
          where: { householdId_month: { householdId: household, month } },
          create: { householdId: household, month },
          update: {},
        });
        const changed = await tx.monthPeriod.updateMany({
          where: { householdId: household, month, version: value.version },
          data: {
            version: { increment: 1 },
            incomeComplete: value.incomeComplete,
            expenseComplete: value.expenseComplete,
          },
        });
        if (!changed.count) throw new HttpError(409, "此月份已被修改，请刷新后重试");
        for (const entry of value.entries) {
          const where = { lineId_month: { lineId: entry.lineId, month } };
          if (entry.amount === null) {
            await tx.monthlyEntry.deleteMany({
              where: { householdId: household, lineId: entry.lineId, month },
            });
          } else {
            await tx.monthlyEntry.upsert({
              where,
              create: {
                householdId: household,
                lineId: entry.lineId,
                month,
                ownerId: lines.find((l) => l.id === entry.lineId)!.ownerId,
                amountMinor: parseMoney(entry.amount),
                note: entry.note,
                author,
                manuallyEdited: true,
              },
              update: {
                amountMinor: parseMoney(entry.amount),
                note: entry.note,
                author,
                manuallyEdited: true,
              },
            });
          }
        }
        return { saved: true };
      },
      { maxWait: 10000, timeout: 60000 },
    );
  }
  if (resource === "balances" && method === "POST") {
    const value = balanceInput.parse(body);
    const asOf =
      value.precision === "MONTH" ? monthEnd(value.asOf.slice(0, 7)) : value.asOf;
    return db.$transaction(
      async (tx) => {
        await lockAccounts(
          tx,
          household,
          value.entries.map((e) => e.accountId),
        );
        const accounts = await tx.account.findMany({
          where: {
            householdId: household,
            assetEnabled: true,
            id: { in: value.entries.map((e) => e.accountId) },
          },
        });
        if (accounts.length !== value.entries.length)
          throw new HttpError(400, "资产账户不存在");
        for (const entry of value.entries) {
          const data = {
            amountMinor: parseMoney(entry.amount),
            note: entry.note,
            author,
            manuallyEdited: true,
            precision: value.precision,
          };
          if (entry.version === null)
            await tx.assetBalance.create({
              data: {
                ...data,
                householdId: household,
                accountId: entry.accountId,
                asOf,
                ownerId: accounts.find((a) => a.id === entry.accountId)!.ownerId,
              },
            });
          else {
            const changed = await tx.assetBalance.updateMany({
              where: {
                householdId: household,
                accountId: entry.accountId,
                asOf,
                version: entry.version,
              },
              data: { ...data, version: { increment: 1 } },
            });
            if (!changed.count)
              throw new HttpError(409, "资产记录已被修改，请刷新后重试");
          }
        }
        return { saved: true };
      },
      { maxWait: 10000, timeout: 60000 },
    );
  }
  if (resource === "export" && method === "GET") {
    const store = await bootstrap(db, household);
    if (id === "backup")
      return {
        format: "fintracker-backup",
        version: 1,
        household: await db.household.findUniqueOrThrow({
          where: { id: household },
          select: { id: true, name: true },
        }),
        exportedAt: new Date().toISOString(),
        ...store,
      };
    const ownerName = (ownerId: string | null) =>
      store.people.find((p) => p.id === ownerId)?.name ?? "共同";
    if (id === "assets")
      return csv([
        ["日期", "精度", "账户", "归属", "人民币金额", "备注"],
        ...store.balances.map((b) => [
          b.asOf,
          b.precision,
          store.accounts.find((a) => a.id === b.accountId)!.name,
          ownerName(b.ownerId),
          decimal(b.amountMinor),
          b.note,
        ]),
      ]);
    if (id === "monthly")
      return csv([
        ["月份", "类型", "账户或来源", "归属", "人民币金额", "备注"],
        ...store.entries.map((e) => {
          const line = store.lines.find((l) => l.id === e.lineId)!;
          return [
            e.month,
            line.kind,
            line.name,
            ownerName(e.ownerId),
            decimal(e.amountMinor),
            e.note,
          ];
        }),
      ]);
  }
  throw new HttpError(404, "接口不存在");
}
