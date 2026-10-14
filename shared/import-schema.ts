import { z } from "zod";
import { accountTypes, dateSchema, monthSchema, nameSchema } from "./finance.js";

const id = z.string().min(1).max(180),
  minor = z.string().regex(/^-?\d+$/);
export const datasetSchema = z.object({
  version: z.literal(1),
  household: z.object({ id, name: nameSchema }),
  people: z.array(z.object({ id, name: nameSchema })).length(2),
  accounts: z.array(
    z.object({
      id,
      name: nameSchema,
      type: z.enum(accountTypes),
      ownerId: id.nullable(),
      assetEnabled: z.boolean(),
      expenseEnabled: z.boolean(),
      archived: z.boolean().default(false),
      version: z.number().int().nonnegative().optional(),
    }),
  ),
  lines: z.array(
    z.object({
      id,
      name: nameSchema,
      kind: z.enum(["INCOME", "EXPENSE"]),
      ownerId: id.nullable(),
      accountId: id.nullable(),
      archived: z.boolean().default(false),
    }),
  ),
  periods: z.array(
    z.object({
      month: monthSchema,
      incomeComplete: z.boolean(),
      expenseComplete: z.boolean(),
      version: z.number().int().nonnegative().optional(),
    }),
  ),
  entries: z.array(
    z.object({
      lineId: id,
      month: monthSchema,
      ownerId: id.nullable(),
      amountMinor: minor,
      note: z.string().max(500),
      manuallyEdited: z.boolean().optional(),
    }),
  ),
  balances: z.array(
    z.object({
      accountId: id,
      asOf: dateSchema,
      precision: z.enum(["DAY", "MONTH"]),
      ownerId: id.nullable(),
      amountMinor: minor.refine((v) => !v.startsWith("-")),
      note: z.string().max(500),
      manuallyEdited: z.boolean().optional(),
      version: z.number().int().nonnegative().optional(),
    }),
  ),
  references: z.array(
    z.object({
      id,
      source: z.string(),
      kind: z.string(),
      period: z.string(),
      ownerId: id.nullable(),
      valueMinor: minor.nullable(),
      note: z.string(),
    }),
  ),
});
export type Dataset = z.infer<typeof datasetSchema>;
export function validateRelations(data: Dataset) {
  const people = new Set(data.people.map((p) => p.id)),
    accounts = new Map(data.accounts.map((a) => [a.id, a])),
    lines = new Map(data.lines.map((l) => [l.id, l]));
  for (const row of [
    ...data.accounts,
    ...data.lines,
    ...data.entries,
    ...data.balances,
    ...data.references,
  ]) {
    if (row.ownerId && !people.has(row.ownerId))
      throw new Error("Import references an unknown owner");
  }
  for (const line of data.lines)
    if (line.accountId && !accounts.has(line.accountId))
      throw new Error("Import references an unknown account");
  for (const entry of data.entries)
    if (!lines.has(entry.lineId))
      throw new Error("Import references an unknown ledger line");
  for (const balance of data.balances)
    if (!accounts.get(balance.accountId)?.assetEnabled)
      throw new Error("Import references an invalid asset account");
  for (const [label, keys] of [
    ["accounts", data.accounts.map((r) => r.id)],
    ["people", data.people.map((r) => r.id)],
    ["lines", data.lines.map((r) => r.id)],
    ["periods", data.periods.map((r) => r.month)],
    ["entries", data.entries.map((r) => `${r.lineId}/${r.month}`)],
    ["balances", data.balances.map((r) => `${r.accountId}/${r.asOf}`)],
  ] as const)
    if (new Set(keys).size !== keys.length) throw new Error(`Duplicate import ${label}`);
}
