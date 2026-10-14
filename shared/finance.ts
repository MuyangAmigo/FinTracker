import { z } from "zod";

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const date = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === v;
  }, "日期无效");
export const moneySchema = z
  .string()
  .regex(/^-?\d{1,12}(\.\d{1,2})?$/, "金额最多两位小数");
export const nameSchema = z.string().trim().min(1).max(80);
export const ownerSchema = z.string().min(1).nullable();
export const accountTypes = [
  "BANK",
  "WALLET",
  "DEPOSIT",
  "INVESTMENT",
  "INSURANCE",
  "PROPERTY",
  "VEHICLE",
  "CREDIT_CARD",
  "SHARED_POT",
  "OTHER",
] as const;
export const typeLabels: Record<(typeof accountTypes)[number], string> = {
  BANK: "银行余额",
  WALLET: "电子钱包",
  DEPOSIT: "存款",
  INVESTMENT: "投资",
  INSURANCE: "保险",
  PROPERTY: "房产",
  VEHICLE: "车辆",
  CREDIT_CARD: "信用卡",
  SHARED_POT: "公用小荷包",
  OTHER: "其他",
};
export const accountInput = z
  .object({
    name: nameSchema,
    type: z.enum(accountTypes),
    ownerId: ownerSchema,
    assetEnabled: z.boolean(),
    expenseEnabled: z.boolean(),
    archived: z.boolean().default(false),
    version: z.number().int().nonnegative().optional(),
  })
  .refine((a) => a.type !== "CREDIT_CARD" || !a.assetEnabled, "信用卡支出不属于资产余额");
export const lineInput = z.object({ name: nameSchema, ownerId: ownerSchema });
export const monthInput = z
  .object({
    version: z.number().int().nonnegative(),
    incomeComplete: z.boolean(),
    expenseComplete: z.boolean(),
    entries: z
      .array(
        z.object({
          lineId: z.string().min(1),
          amount: moneySchema.nullable(),
          note: z.string().max(500),
        }),
      )
      .max(300),
  })
  .refine(
    (v) => new Set(v.entries.map((e) => e.lineId)).size === v.entries.length,
    "不能重复记录同一行",
  );
export const balanceInput = z
  .object({
    asOf: dateSchema,
    precision: z.enum(["DAY", "MONTH"]),
    entries: z
      .array(
        z.object({
          accountId: z.string().min(1),
          amount: moneySchema.refine((v) => !v.startsWith("-"), "资产金额不能为负"),
          note: z.string().max(500),
          version: z.number().int().nonnegative().nullable(),
        }),
      )
      .min(1)
      .max(300),
  })
  .refine(
    (v) => new Set(v.entries.map((e) => e.accountId)).size === v.entries.length,
    "不能重复记录同一账户",
  );

export function parseMoney(value: string): bigint {
  const valid = moneySchema.parse(value);
  const negative = valid.startsWith("-");
  const [whole, fraction = ""] = valid.replace(/^-/, "").split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -amount : amount;
}
export function decimal(minor: string | bigint): string {
  const value = BigInt(minor);
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}
export function money(minor: string | bigint): string {
  const value = BigInt(minor);
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}¥${new Intl.NumberFormat("zh-CN").format(abs / 100n)}.${String(abs % 100n).padStart(2, "0")}`;
}
export function monthEnd(month: string): string {
  monthSchema.parse(month);
  const [year, number] = month.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, number, 0);
  return date.toISOString().slice(0, 10);
}
export function savingsRate(
  income: bigint,
  expense: bigint,
  complete: boolean,
): string | null {
  if (!complete || income <= 0n) return null;
  const hundredths =
    ((income - expense) * 10000n +
      (income - expense >= 0n ? income / 2n : -income / 2n)) /
    income;
  return `${decimal(hundredths)}%`;
}

export interface Person {
  id: string;
  name: string;
}
export interface Account {
  id: string;
  name: string;
  type: (typeof accountTypes)[number];
  ownerId: string | null;
  assetEnabled: boolean;
  expenseEnabled: boolean;
  archived: boolean;
  version: number;
}
export interface Line {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  ownerId: string | null;
  accountId: string | null;
  archived: boolean;
}
export interface Entry {
  id: string;
  lineId: string;
  month: string;
  ownerId: string | null;
  amountMinor: string;
  note: string;
}
export interface Period {
  month: string;
  incomeComplete: boolean;
  expenseComplete: boolean;
  version: number;
}
export interface Balance {
  id: string;
  accountId: string;
  asOf: string;
  precision: "DAY" | "MONTH";
  ownerId: string | null;
  amountMinor: string;
  note: string;
  version: number;
}
export interface Reference {
  id: string;
  source: string;
  kind: string;
  period: string;
  ownerId: string | null;
  valueMinor: string | null;
  note: string;
}
export interface Store {
  people: Person[];
  accounts: Account[];
  lines: Line[];
  periods: Period[];
  entries: Entry[];
  balances: Balance[];
  references: Reference[];
}
export function cashFlow(store: Store, period: string, owner: string = "ALL") {
  let income = 0n,
    expense = 0n;
  const lineKinds = new Map(store.lines.map((l) => [l.id, l.kind]));
  for (const entry of store.entries) {
    if (
      !entry.month.startsWith(period) ||
      (owner !== "ALL" && (entry.ownerId ?? "SHARED") !== owner)
    )
      continue;
    if (lineKinds.get(entry.lineId) === "INCOME") income += BigInt(entry.amountMinor);
    else expense += BigInt(entry.amountMinor);
  }
  return { income, expense, savings: income - expense };
}
export function latestBalances(store: Store, asOf: string, owner: string = "ALL") {
  const latest = new Map<string, Balance>();
  const assets = new Set(store.accounts.filter((a) => a.assetEnabled).map((a) => a.id));
  for (const balance of store.balances) {
    if (!assets.has(balance.accountId) || balance.asOf > asOf) continue;
    if (
      !latest.has(balance.accountId) ||
      latest.get(balance.accountId)!.asOf < balance.asOf
    )
      latest.set(balance.accountId, balance);
  }
  return [...latest.values()].filter(
    (b) => owner === "ALL" || (b.ownerId ?? "SHARED") === owner,
  );
}
export function csv(rows: (string | null)[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let value = cell ?? "";
            if (
              /^[\s]*[=+@\t\r]/.test(value) ||
              (/^[\s]*-/.test(value) && !/^-?\d+(\.\d+)?$/.test(value))
            )
              value = "'" + value;
            return `"${value.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n")
  );
}
