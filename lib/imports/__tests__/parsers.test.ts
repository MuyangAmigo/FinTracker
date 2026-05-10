import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { detectImportFormat } from "@/lib/imports/format-detect";
import { parseHouseholdMonthly } from "@/lib/imports/parsers/household-monthly";
import { parsePersonalOverview } from "@/lib/imports/parsers/personal-overview";

const ASSET_DIR = join(process.cwd(), "assets/csv-record-tracker");

function read(name: string): string {
  return readFileSync(join(ASSET_DIR, name), "utf8");
}

describe("personal overview parser (live CSV)", () => {
  const csv = read("Finance 2024 - Overview - Junjie.csv");

  it("detects the format from the header", () => {
    expect(detectImportFormat(csv)).toBe("PERSONAL_OVERVIEW");
  });

  it("produces account snapshot records", () => {
    const result = parsePersonalOverview(csv);
    expect(result.format).toBe("PERSONAL_OVERVIEW");
    expect(result.records.length).toBeGreaterThan(0);

    // 2024 Jan, Alipay column, ¥34,866.97 → 3486697 minor
    const janAlipay = result.records.find(
      (r) => r.asOf === "2024-01-01" && r.accountName === "Alipay",
    );
    expect(janAlipay).toBeDefined();
    expect(janAlipay!.amountMinor).toBe(3486697);
    expect(janAlipay!.currency).toBe("CNY");
  });

  it("excludes total columns", () => {
    const result = parsePersonalOverview(csv);
    const totals = result.records.filter((r) =>
      r.accountName.toLowerCase().includes("total"),
    );
    expect(totals).toEqual([]);
  });

  it("derives covers-from and covers-to across the multi-year file", () => {
    const result = parsePersonalOverview(csv);
    // The "2024" overview file actually carries 2022-2024 history.
    expect(result.coversFrom).toBe("2022-02-01");
    expect(result.coversTo).toMatch(/^2024-/);
  });

  it("parses full-name months (e.g. '2022 June')", () => {
    const result = parsePersonalOverview(csv);
    const juneRows = result.records.filter((r) => r.asOf === "2022-06-01");
    expect(juneRows.length).toBeGreaterThan(0);
  });
});

describe("household monthly parser (live CSV)", () => {
  const csv = read("Household Finance Management - 2024 - Personal Finance Management - 2024.csv");

  it("detects the format", () => {
    expect(detectImportFormat(csv)).toBe("HOUSEHOLD_MONTHLY");
  });

  it("produces transaction records for income and expense sections", () => {
    const result = parseHouseholdMonthly(csv, {
      filename: "Household Finance Management - 2024 - Personal Finance Management - 2024.csv",
    });
    expect(result.format).toBe("HOUSEHOLD_MONTHLY");
    expect(result.records.length).toBeGreaterThan(20);

    const income = result.records.filter((r) => r.txnKind === "INCOME");
    const expense = result.records.filter((r) => r.txnKind === "EXPENSE");
    expect(income.length).toBeGreaterThan(0);
    expect(expense.length).toBeGreaterThan(0);
  });

  it("parses Junjie salary in January 2024 to the correct amount", () => {
    const result = parseHouseholdMonthly(csv, { filename: "2024.csv" });
    const janSalary = result.records.find(
      (r) =>
        r.occurredOn === "2024-01-01" &&
        r.label === "Salary - Junjie" &&
        r.txnKind === "INCOME",
    );
    expect(janSalary).toBeDefined();
    // ¥30,877.83 → 3087783 minor
    expect(janSalary!.amountMinor).toBe(3087783);
    expect(janSalary!.personTag).toBe("Junjie");
    expect(janSalary!.currency).toBe("CNY");
  });

  it("preserves Chinese category labels and treats them as household scope", () => {
    const result = parseHouseholdMonthly(csv, { filename: "2024.csv" });
    const dating = result.records.find(
      (r) => r.label === "恋爱金" && r.occurredOn === "2024-01-01",
    );
    expect(dating).toBeDefined();
    expect(dating!.personTag).toBeNull();
    // ¥10,087.35 → 1008735 minor
    expect(dating!.amountMinor).toBe(1008735);
  });

  it("handles accounting-style negative amounts as positive expense magnitudes", () => {
    // (¥547.40) appears for "招行卡 - Junjie" in March 2024.
    const result = parseHouseholdMonthly(csv, { filename: "2024.csv" });
    const cmbMar = result.records.find(
      (r) =>
        r.label === "招行卡 - Junjie" &&
        r.occurredOn === "2024-03-01" &&
        r.txnKind === "EXPENSE",
    );
    expect(cmbMar).toBeDefined();
    // We strip the sign because the model is "amount of expense"; the sign is
    // implied by txnKind.
    expect(cmbMar!.amountMinor).toBe(54740);
  });

  it("ignores Total rows", () => {
    const result = parseHouseholdMonthly(csv, { filename: "2024.csv" });
    expect(result.records.find((r) => r.label === "Total")).toBeUndefined();
  });
});
