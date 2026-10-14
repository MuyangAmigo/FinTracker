import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadDataset } from "./import.js";
import { db, execute, bootstrap } from "./service.js";
import { HttpError } from "./auth.js";
import type { Dataset } from "../../shared/import-schema.js";

const household = `integration-${process.pid}`;
const a = `${household}-a`,
  b = `${household}-b`,
  bank = `${household}-bank`,
  salary = `${household}-salary`;
const identity = {
  tenantId: "synthetic-tenant",
  objectId: "synthetic-user",
  personId: a,
};
const data: Dataset = {
  version: 1,
  household: { id: household, name: "Synthetic integration household" },
  people: [
    { id: a, name: "Person A" },
    { id: b, name: "Person B" },
  ],
  accounts: [
    {
      id: bank,
      name: "Bank",
      type: "BANK",
      ownerId: a,
      assetEnabled: true,
      expenseEnabled: false,
      archived: false,
    },
  ],
  lines: [
    {
      id: salary,
      name: "Salary",
      kind: "INCOME",
      ownerId: a,
      accountId: null,
      archived: false,
    },
  ],
  periods: [{ month: "2024-01", incomeComplete: true, expenseComplete: false }],
  entries: [
    { lineId: salary, month: "2024-01", ownerId: a, amountMinor: "10000", note: "" },
  ],
  balances: [
    {
      accountId: bank,
      asOf: "2024-01-31",
      precision: "MONTH",
      ownerId: a,
      amountMinor: "10000",
      note: "",
    },
  ],
  references: [],
};
describe.skipIf(!process.env.DATABASE_URL)("PostgreSQL finance operations", () => {
  beforeAll(async () => {
    process.env.HOUSEHOLD_ID = household;
    await loadDataset(db, data);
  }, 30000);
  afterAll(async () => {
    await db.monthlyEntry.deleteMany({ where: { householdId: household } });
    await db.assetBalance.deleteMany({ where: { householdId: household } });
    await db.sourceReference.deleteMany({ where: { householdId: household } });
    await db.monthPeriod.deleteMany({ where: { householdId: household } });
    await db.ledgerLine.deleteMany({ where: { householdId: household } });
    await db.account.deleteMany({ where: { householdId: household } });
    await db.person.deleteMany({ where: { householdId: household } });
    await db.household.deleteMany({ where: { id: household } });
    await db.$disconnect();
  });
  it("imports twice without duplication", async () => {
    await loadDataset(db, data);
    expect(await db.monthlyEntry.count({ where: { householdId: household } })).toBe(1);
    expect(await db.assetBalance.count({ where: { householdId: household } })).toBe(1);
  });
  it("atomically saves a month, preserves asset balances, and detects stale edits", async () => {
    const payload = {
      version: 0,
      incomeComplete: true,
      expenseComplete: true,
      entries: [{ lineId: salary, amount: "123.45", note: "synthetic" }],
    };
    await execute("months", "2024-01", "PUT", payload, identity);
    expect(
      (
        await db.monthlyEntry.findUniqueOrThrow({
          where: { lineId_month: { lineId: salary, month: "2024-01" } },
        })
      ).amountMinor,
    ).toBe(12345n);
    expect(
      (await db.assetBalance.findFirstOrThrow({ where: { householdId: household } }))
        .amountMinor,
    ).toBe(10000n);
    await expect(
      execute("months", "2024-01", "PUT", payload, identity),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("reimport preserves manually edited data and completion versions", async () => {
    await loadDataset(db, data);
    expect(
      (await db.monthlyEntry.findFirstOrThrow({ where: { householdId: household } }))
        .amountMinor,
    ).toBe(12345n);
    expect(
      (await db.monthPeriod.findFirstOrThrow({ where: { householdId: household } }))
        .expenseComplete,
    ).toBe(true);
  });
  it("keeps earlier snapshots and rejects stale valuation updates", async () => {
    const payload = {
      asOf: "2024-02-14",
      precision: "DAY",
      entries: [{ accountId: bank, amount: "200", note: "", version: null }],
    };
    await execute("balances", undefined, "POST", payload, identity);
    expect(await db.assetBalance.count({ where: { householdId: household } })).toBe(2);
    await expect(
      execute(
        "balances",
        undefined,
        "POST",
        { ...payload, entries: [{ ...payload.entries[0], amount: "999", version: 9 }] },
        identity,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects accounts outside the household and unaffiliated identities", async () => {
    await expect(
      execute(
        "balances",
        undefined,
        "POST",
        {
          asOf: "2024-02-15",
          precision: "DAY",
          entries: [
            { accountId: "not-this-household", amount: "1", note: "", version: null },
          ],
        },
        identity,
      ),
    ).rejects.toBeInstanceOf(HttpError);
    await expect(
      execute("bootstrap", undefined, "GET", null, {
        ...identity,
        personId: "not-a-member",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("preserves a prior owner's snapshot after changing account ownership", async () => {
    const account = await db.account.findUniqueOrThrow({ where: { id: bank } });
    await execute("accounts", bank, "PUT", { ...account, ownerId: b }, identity);
    expect(
      (await db.assetBalance.findFirstOrThrow({ where: { accountId: bank } })).ownerId,
    ).toBe(a);
    await expect(
      execute(
        "accounts",
        bank,
        "PUT",
        { ...account, version: 1, ownerId: b, assetEnabled: false },
        identity,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("exports authorized records and excludes other household data", async () => {
    const result = await bootstrap(db, household);
    expect(result.people.map((p) => p.id)).toEqual(expect.arrayContaining([a, b]));
    expect(result.entries.every((e) => e.householdId === household)).toBe(true);
    const backup = await execute("export", "backup", "GET", null, identity);
    expect(backup).toHaveProperty("format", "fintracker-backup");
  });
  it("does not resurrect a cleared monthly row during reimport", async () => {
    await execute(
      "months",
      "2024-01",
      "PUT",
      {
        version: 1,
        incomeComplete: false,
        expenseComplete: false,
        entries: [{ lineId: salary, amount: null, note: "" }],
      },
      identity,
    );
    await loadDataset(db, data);
    expect(await db.monthlyEntry.count({ where: { householdId: household } })).toBe(0);
  });
});
