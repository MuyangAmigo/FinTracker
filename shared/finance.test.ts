import { describe, expect, it } from "vitest";
import {
  balanceInput,
  cashFlow,
  csv,
  dateSchema,
  decimal,
  latestBalances,
  money,
  monthEnd,
  monthInput,
  parseMoney,
  savingsRate,
  type Store,
} from "./finance.js";
import { identify, HttpError } from "../api/src/auth.js";
import { legacyMoney, normalize } from "../scripts/normalize.js";
import { reconcile } from "../api/src/import.js";

const store: Store = {
  people: [
    { id: "a", name: "Person A" },
    { id: "b", name: "Person B" },
  ],
  accounts: [
    {
      id: "bank",
      name: "Bank",
      type: "BANK",
      ownerId: "a",
      assetEnabled: true,
      expenseEnabled: false,
      archived: true,
      version: 0,
    },
  ],
  lines: [
    {
      id: "salary",
      name: "Salary",
      kind: "INCOME",
      ownerId: "a",
      accountId: null,
      archived: false,
    },
    {
      id: "pot",
      name: "Shared",
      kind: "EXPENSE",
      ownerId: null,
      accountId: null,
      archived: false,
    },
  ],
  periods: [],
  references: [],
  entries: [
    {
      id: "1",
      lineId: "salary",
      month: "2024-01",
      ownerId: "a",
      amountMinor: "200000",
      note: "",
    },
    {
      id: "2",
      lineId: "pot",
      month: "2024-01",
      ownerId: null,
      amountMinor: "12345",
      note: "",
    },
  ],
  balances: [
    {
      id: "1",
      accountId: "bank",
      asOf: "2024-01-31",
      precision: "MONTH",
      ownerId: "a",
      amountMinor: "10000",
      note: "",
      version: 0,
    },
    {
      id: "2",
      accountId: "bank",
      asOf: "2024-03-10",
      precision: "DAY",
      ownerId: "b",
      amountMinor: "9000",
      note: "",
      version: 0,
    },
  ],
};
describe("exact finance behavior", () => {
  it("parses exact minor units and refunds without floating point", () => {
    expect(parseMoney("0.10") + parseMoney("0.20")).toBe(30n);
    expect(decimal(parseMoney("-1.05"))).toBe("-1.05");
    expect(() => parseMoney("1.001")).toThrow();
    expect(() => parseMoney("1e3")).toThrow();
    expect(money("900719925474099312")).toBe("¥9,007,199,254,740,993.12");
  });
  it("preserves signed legacy values and missing cells", () => {
    expect(legacyMoney("(¥10.25)")).toBe("-1025");
    expect(legacyMoney("¥0.00")).toBe("0");
    expect(legacyMoney(" ")).toBeNull();
  });
  it("validates real calendar dates and leap months", () => {
    expect(monthEnd("2024-02")).toBe("2024-02-29");
    expect(dateSchema.safeParse("2024-02-30").success).toBe(false);
  });
  it("counts shared expenses once and never allocates them to a person", () => {
    expect(cashFlow(store, "2024-01")).toEqual({
      income: 200000n,
      expense: 12345n,
      savings: 187655n,
    });
    expect(cashFlow(store, "2024-01", "a").expense).toBe(0n);
    expect(cashFlow(store, "2024", "SHARED").expense).toBe(12345n);
  });
  it("does not calculate savings rates for missing or zero income", () => {
    expect(savingsRate(0n, 1n, true)).toBeNull();
    expect(savingsRate(100n, 20n, false)).toBeNull();
    expect(savingsRate(10000n, 2500n, true)).toBe("75.00%");
    expect(savingsRate(10000n, 15000n, true)).toBe("-50.00%");
  });
  it("carries forward only prior valuations, including archived balances", () => {
    expect(latestBalances(store, "2023-12-31")).toHaveLength(0);
    expect(latestBalances(store, "2024-02-29")[0].amountMinor).toBe("10000");
    expect(latestBalances(store, "2024-04-30", "a")).toHaveLength(0);
    expect(latestBalances(store, "2024-04-30", "b")[0].amountMinor).toBe("9000");
  });
  it("rejects duplicate batch rows and negative assets", () => {
    expect(
      monthInput.safeParse({
        version: 0,
        incomeComplete: false,
        expenseComplete: false,
        entries: [
          { lineId: "1", amount: null, note: "" },
          { lineId: "1", amount: "0", note: "" },
        ],
      }).success,
    ).toBe(false);
    expect(
      balanceInput.safeParse({
        asOf: "2024-01-01",
        precision: "DAY",
        entries: [{ accountId: "a", amount: "-1", note: "", version: null }],
      }).success,
    ).toBe(false);
  });
  it("escapes CSV formulas, quotes, and Chinese labels while preserving numeric refunds", () => {
    expect(csv([["=CMD()", '双"引号', "-10.25", "-cmd", " @SUM(A1)"]])).toBe(
      '\uFEFF"\'=CMD()","双""引号","-10.25","\'-cmd","\' @SUM(A1)"',
    );
  });
});
describe("identity and scope authorization", () => {
  const identities = [
    { tenantId: "tenant", objectId: "user-a", personId: "a" },
    { tenantId: "tenant", objectId: "user-b", personId: "b" },
  ];
  it("permits only configured identities with the API scope", () => {
    expect(
      identify(
        { tid: "tenant", oid: "user-a", ver: "2.0", scp: "access_as_user" },
        identities,
        "access_as_user",
      ).personId,
    ).toBe("a");
    expect(() =>
      identify(
        { tid: "tenant", oid: "intruder", ver: "2.0", scp: "access_as_user" },
        identities,
        "access_as_user",
      ),
    ).toThrow(HttpError);
    expect(() =>
      identify(
        { tid: "tenant", oid: "user-a", ver: "2.0", scp: "User.Read" },
        identities,
        "access_as_user",
      ),
    ).toThrow(HttpError);
    expect(() =>
      identify(
        { tid: "tenant", oid: "user-a", ver: "2.0" },
        identities,
        "access_as_user",
      ),
    ).toThrow(HttpError);
  });
});
describe("private source normalization", () => {
  const supplement = {
    householdName: "Test household",
    people: ["Person A", "Person B"],
    assetAliases: {},
    monthly: [],
    assetSheets: [],
    properties: [],
    annualReferences: [],
  };
  it("deduplicates repeated account history without importing subtotal assets", () => {
    const text =
      "Month,Alipay,Grand Total,Personal Total,Notes\n2024 Jan,¥100.00,¥100.00,¥80.00,source note\n";
    const result = normalize(
      [
        { name: "Finance 2024 - Overview - Person A.csv", text },
        { name: "Finance 2025 - Overview - Person A.csv", text },
      ],
      supplement,
    );
    expect(result.data.balances).toHaveLength(1);
    expect(result.data.accounts).toHaveLength(1);
    expect(result.duplicates).toBe(1);
    expect(result.conflicts).toHaveLength(0);
  });
  it("parses person ownership before parenthetical label notes", () => {
    const text =
      "January Income,,February Income,\nSalary - Person A,¥100.00,Salary - Person A,\nTotal,¥100.00,Total,¥0.00\nJanuary Expenses,,February Expenses,\n卡 - Person A (5.00),¥0.00,卡 - Person A,\nTotal,¥0.00,Total,¥0.00\n";
    const result = normalize([{ name: "Household 2024.csv", text }], supplement);
    const expense = result.data.entries.find(
      (e) => result.data.lines.find((l) => l.id === e.lineId)?.kind === "EXPENSE",
    )!;
    expect(expense.ownerId).toBe(result.data.people[0].id);
    expect(expense.amountMinor).toBe("0");
    expect(expense.note).toContain("5.00");
    expect(result.data.periods).toHaveLength(1);
    expect(
      reconcile(result.data).find(
        (r) => r.kind === "MONTH_INCOME" && r.period === "2024-01",
      )?.differenceMinor,
    ).toBe("0");
  });
  it("prefers screenshot values and flags conflicts between CSVs", () => {
    const a = {
      name: "Finance 2024 - Overview - Person A.csv",
      text: "Month,Bank\n2024 Jan,¥10.00\n",
    };
    const b = {
      name: "Finance 2025 - Overview - Person A.csv",
      text: "Month,Bank\n2024 Jan,¥20.00\n",
    };
    const result = normalize([a, b], {
      ...supplement,
      assetSheets: [
        { owner: "Person A", headers: ["Month", "Bank"], rows: [["2024 Jan", "30.00"]] },
      ],
    });
    expect(normalize([a, b], supplement).conflicts).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data.balances[0].amountMinor).toBe("3000");
  });
});
