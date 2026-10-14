import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import Papa from "papaparse";
import { z } from "zod";
import {
  datasetSchema,
  validateRelations,
  type Dataset,
} from "../shared/import-schema.js";
import { monthEnd, parseMoney } from "../shared/finance.js";

export function legacyMoney(raw: string): string | null {
  if (!raw.trim()) return null;
  let value = raw.trim().replace(/[¥￥,\s]/g, "");
  if (/^\(.*\)$/.test(value)) value = `-${value.slice(1, -1)}`;
  return parseMoney(value).toString();
}
export function stableId(...parts: string[]) {
  return createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
}
const monthNames = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
function sourceMonth(raw: string) {
  const match = raw.trim().match(/^(\d{4})\s+([a-z]+)$/i);
  if (!match) throw new Error(`Invalid month label: ${raw}`);
  const number = monthNames.findIndex((m) => m.startsWith(match[2].toLowerCase())) + 1;
  if (!number) throw new Error(`Invalid month label: ${raw}`);
  return `${match[1]}-${String(number).padStart(2, "0")}`;
}
const supplementSchema = z.object({
  householdName: z.string(),
  people: z.array(z.string()).length(2),
  assetAliases: z.record(z.string(), z.string()).default({}),
  monthly: z
    .array(
      z.object({
        month: z.string(),
        incomeComplete: z.boolean(),
        expenseComplete: z.boolean(),
        income: z.array(
          z.tuple([z.string(), z.string().nullable(), z.string(), z.string()]),
        ),
        expense: z.array(
          z.tuple([z.string(), z.string().nullable(), z.string(), z.string()]),
        ),
      }),
    )
    .default([]),
  assetSheets: z
    .array(
      z.object({
        owner: z.string(),
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      }),
    )
    .default([]),
  properties: z
    .array(
      z.object({
        month: z.string(),
        owner: z.string(),
        property: z.string(),
        vehicle: z.string(),
        financialReference: z.string(),
        totalReference: z.string(),
      }),
    )
    .default([]),
  annualReferences: z
    .array(z.object({ year: z.string(), income: z.string(), expense: z.string() }))
    .default([]),
  combinedAssetTotals: z
    .array(z.object({ month: z.string(), total: z.string() }))
    .default([]),
});
export function normalize(
  files: { name: string; text: string }[],
  input: z.input<typeof supplementSchema>,
) {
  const supplement = supplementSchema.parse(input);
  const data: Dataset = {
    version: 1,
    household: { id: "household", name: supplement.householdName },
    people: supplement.people.map((name) => ({ id: stableId("person", name), name })),
    accounts: [],
    lines: [],
    periods: [],
    entries: [],
    balances: [],
    references: [],
  };
  const entryMap = new Map<string, Dataset["entries"][number]>(),
    balanceMap = new Map<string, Dataset["balances"][number]>(),
    periods = new Map<string, Dataset["periods"][number]>();
  const conflicts = new Map<string, string>();
  let duplicates = 0;
  function owner(name: string | null) {
    if (!name) return null;
    const person = data.people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!person) throw new Error(`Unknown source owner: ${name}`);
    return person.id;
  }
  function label(raw: string) {
    let person: string | null = null,
      value = raw.trim(),
      note = "";
    const parentheses = value.match(/\s*\(([^)]*)\)\s*$/);
    if (parentheses) {
      note = parentheses[1];
      value = value.slice(0, parentheses.index).trim();
    }
    for (const name of supplement.people) {
      const suffix = ` - ${name}`;
      if (value.toLowerCase().endsWith(suffix.toLowerCase())) {
        person = name;
        value = value.slice(0, -suffix.length).trim();
      }
    }
    if (!person && value.includes(" - ")) {
      const [base, ...rest] = value.split(" - ");
      value = base;
      note = [rest.join(" - "), note].filter(Boolean).join("; ");
    }
    return { name: value, ownerId: owner(person), note };
  }
  function account(
    name: string,
    ownerId: string | null,
    asset: boolean,
    type: Dataset["accounts"][number]["type"],
  ) {
    const canonical = asset ? (supplement.assetAliases[name] ?? name) : name;
    const id = stableId(
      "account",
      ownerId ?? "shared",
      asset ? "asset" : "expense",
      canonical,
    );
    if (!data.accounts.some((a) => a.id === id))
      data.accounts.push({
        id,
        name: canonical,
        ownerId,
        type,
        assetEnabled: asset,
        expenseEnabled: !asset,
        archived: false,
      });
    return id;
  }
  function line(name: string, ownerId: string | null, kind: "INCOME" | "EXPENSE") {
    const accountId =
      kind === "EXPENSE"
        ? account(
            name,
            ownerId,
            false,
            name.includes("卡") ? "CREDIT_CARD" : "SHARED_POT",
          )
        : null;
    const id = stableId("line", kind, ownerId ?? "shared", name);
    if (!data.lines.some((l) => l.id === id))
      data.lines.push({ id, name, ownerId, kind, accountId, archived: false });
    return id;
  }
  function entry(
    month: string,
    rawLabel: string,
    amountMinor: string,
    kind: "INCOME" | "EXPENSE",
    source: string,
    override = false,
    explicitOwner?: string | null,
    explicitNote?: string,
  ) {
    const parsed = label(rawLabel),
      ownerId = explicitOwner !== undefined ? owner(explicitOwner) : parsed.ownerId;
    const lineId = line(parsed.name, ownerId, kind),
      key = `${lineId}/${month}`;
    const record = {
      lineId,
      month,
      ownerId,
      amountMinor,
      note: [explicitNote ?? parsed.note, `来源: ${source}`]
        .filter(Boolean)
        .join("; ")
        .slice(0, 500),
    };
    const previous = entryMap.get(key);
    if (previous) {
      duplicates++;
      if (previous.amountMinor !== amountMinor && !override)
        conflicts.set(key, `Monthly source conflict: ${key}`);
    }
    if (override) conflicts.delete(key);
    if (!previous || override) entryMap.set(key, record);
    if (!periods.has(month))
      periods.set(month, { month, incomeComplete: false, expenseComplete: false });
  }
  function assetRow(
    name: string,
    headers: string[],
    row: string[],
    source: string,
    override = false,
  ) {
    if (!row[0]?.trim()) return;
    const month = sourceMonth(row[0]),
      ownerId = owner(name);
    headers.slice(1).forEach((header, index) => {
      const raw = row[index + 1] ?? "";
      if (!header.trim()) return;
      if (/notes?/i.test(header)) {
        if (raw) reference(source, "NOTES", month, ownerId, null, raw);
        return;
      }
      const value = legacyMoney(raw);
      if (value === null) return;
      if (/total|bank deposit|^investment$/i.test(header)) {
        reference(
          source,
          header,
          month,
          ownerId,
          value,
          "Original subtotal; not an extra asset",
        );
        return;
      }
      const type = /insurance/i.test(header)
        ? "INSURANCE"
        : /stock|espp|wealth/i.test(header)
          ? "INVESTMENT"
          : /alipay|wechat/i.test(header)
            ? "WALLET"
            : /saving/i.test(header)
              ? "DEPOSIT"
              : "BANK";
      const accountId = account(header, ownerId, true, type),
        asOf = monthEnd(month),
        key = `${accountId}/${asOf}`;
      const previous = balanceMap.get(key);
      if (previous) {
        duplicates++;
        if (previous.amountMinor !== value && !override)
          conflicts.set(key, `Asset source conflict: ${key}`);
      }
      if (override) conflicts.delete(key);
      if (!previous || override)
        balanceMap.set(key, {
          accountId,
          asOf,
          precision: "MONTH",
          ownerId,
          amountMinor: value,
          note: `来源: ${source}`,
        });
    });
  }
  function reference(
    source: string,
    kind: string,
    period: string,
    ownerId: string | null,
    valueMinor: string | null,
    note = "",
  ) {
    const id = stableId("reference", source, kind, period, ownerId ?? "shared");
    if (!data.references.some((r) => r.id === id))
      data.references.push({ id, source, kind, period, ownerId, valueMinor, note });
  }
  for (const file of files.toSorted((a, b) => b.name.localeCompare(a.name))) {
    const parsed = Papa.parse<string[]>(file.text.replace(/^\uFEFF/, ""), {
      skipEmptyLines: true,
    });
    if (parsed.errors.length) throw new Error(`CSV parsing failed: ${file.name}`);
    const rows = parsed.data;
    const overview = file.name.match(/Overview\s*-\s*(.+)\.csv$/i);
    if (overview) {
      const index = rows.findIndex((r) =>
        r.some((c) => c.trim().toLowerCase() === "month"),
      );
      if (index < 0) throw new Error("Missing asset header");
      const first = rows[index].findIndex((c) => c.trim().toLowerCase() === "month");
      const headers = rows[index].slice(first);
      for (const row of rows.slice(index + 1))
        assetRow(overview[1], headers, row.slice(first), file.name);
      continue;
    }
    const year = file.name.match(/20\d{2}/)?.[0];
    if (!year) throw new Error("CSV needs an explicit source year");
    let kind: "INCOME" | "EXPENSE" = "INCOME",
      columns: { index: number; month: string }[] = [];
    const completeness = new Map<string, { seen: number; filled: number }>();
    for (const row of rows) {
      const section = row
        .map((cell, index) => {
          const match = cell
            .trim()
            .toLowerCase()
            .match(/^([a-z]+)\s+(income|expenses?)$/);
          if (!match) return null;
          const number = monthNames.indexOf(match[1]) + 1;
          if (!number) return null;
          kind = match[2] === "income" ? "INCOME" : "EXPENSE";
          return {
            index: index + 1,
            month: `${year}-${String(number).padStart(2, "0")}`,
          };
        })
        .filter((v): v is { index: number; month: string } => v !== null);
      if (section.length) {
        columns = section;
        continue;
      }
      if (/^total (income|expenses)/i.test(row[0] ?? "")) {
        const refKind = /income/i.test(row[0]) ? "ANNUAL_INCOME" : "ANNUAL_EXPENSE";
        const raw = [...row].reverse().find((c) => c.trim().startsWith("¥"));
        if (raw) reference(file.name, refKind, year, null, legacyMoney(raw));
        columns = [];
        continue;
      }
      for (const col of columns) {
        const name = row[col.index - 1]?.trim();
        if (!name) continue;
        const value = legacyMoney(row[col.index] ?? "");
        if (/^total$/i.test(name)) {
          if (value !== null)
            reference(file.name, `MONTH_${kind}`, col.month, null, value);
          continue;
        }
        const key = `${col.month}/${kind}`,
          state = completeness.get(key) ?? { seen: 0, filled: 0 };
        state.seen++;
        if (value !== null) state.filled++;
        completeness.set(key, state);
        if (value !== null) entry(col.month, name, value, kind, file.name);
      }
    }
    for (const [key, counts] of completeness) {
      const [month, kind] = key.split("/"),
        period = periods.get(month);
      if (period)
        period[kind === "INCOME" ? "incomeComplete" : "expenseComplete"] =
          counts.seen > 0 && counts.filled === counts.seen;
    }
  }
  for (const sheet of supplement.assetSheets)
    for (const row of sheet.rows)
      assetRow(sheet.owner, sheet.headers, row, "provided-asset-screenshot", true);
  for (const month of supplement.monthly) {
    for (const kind of ["INCOME", "EXPENSE"] as const)
      for (const [name, person, amount, note] of month[
        kind === "INCOME" ? "income" : "expense"
      ])
        entry(
          month.month,
          name,
          parseMoney(amount).toString(),
          kind,
          "provided-monthly-screenshot",
          true,
          person,
          note,
        );
    periods.set(month.month, {
      month: month.month,
      incomeComplete: month.incomeComplete,
      expenseComplete: month.expenseComplete,
    });
  }
  for (const row of supplement.properties) {
    const ownerId = owner(row.owner);
    for (const [name, type, value] of [
      ["房产（汇总）", "PROPERTY", row.property],
      ["车辆（汇总）", "VEHICLE", row.vehicle],
    ] as const) {
      const accountId = account(name, ownerId, true, type),
        asOf = monthEnd(row.month);
      balanceMap.set(`${accountId}/${asOf}`, {
        accountId,
        asOf,
        precision: "MONTH",
        ownerId,
        amountMinor: parseMoney(value).toString(),
        note: "来源: provided-household-asset-screenshot",
      });
    }
    reference(
      "provided-household-asset-screenshot",
      "Financial subtotal",
      row.month,
      ownerId,
      parseMoney(row.financialReference).toString(),
      "Source reference only; do not double-count financial accounts",
    );
    reference(
      "provided-household-asset-screenshot",
      "Grand Total",
      row.month,
      ownerId,
      parseMoney(row.totalReference).toString(),
    );
  }
  for (const row of supplement.annualReferences) {
    reference(
      "provided-monthly-screenshot",
      "ANNUAL_INCOME",
      row.year,
      null,
      parseMoney(row.income).toString(),
    );
    reference(
      "provided-monthly-screenshot",
      "ANNUAL_EXPENSE",
      row.year,
      null,
      parseMoney(row.expense).toString(),
    );
  }
  for (const row of supplement.combinedAssetTotals)
    reference(
      "provided-household-asset-screenshot",
      "Household Total",
      row.month,
      null,
      parseMoney(row.total).toString(),
      "Original combined total; not an extra asset",
    );
  data.entries = [...entryMap.values()];
  data.balances = [...balanceMap.values()];
  data.periods = [...periods.values()];
  const valid = datasetSchema.parse(data);
  validateRelations(valid);
  return { data: valid, duplicates, conflicts: [...conflicts.values()] };
}
export function privatePath(path: string) {
  const absolute = resolve(path),
    rel = relative(process.cwd(), absolute);
  if (!rel.startsWith("..") && !isAbsolute(rel))
    throw new Error(
      "Private financial inputs and outputs must be outside the repository",
    );
  return absolute;
}
async function main() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const value = args[args.indexOf(name) + 1];
    if (!args.includes(name) || !value) throw new Error(`Missing ${name}`);
    return privatePath(value);
  };
  const directory = get("--csv-dir"),
    supplement = supplementSchema.parse(
      JSON.parse(readFileSync(get("--supplement"), "utf8")),
    );
  const files = readdirSync(directory)
    .filter((f) => f.endsWith(".csv"))
    .map((name) => ({ name, text: readFileSync(resolve(directory, name), "utf8") }));
  const result = normalize(files, supplement);
  writeFileSync(get("--out"), JSON.stringify(result.data, null, 2));
  writeFileSync(
    get("--report"),
    JSON.stringify(
      {
        counts: {
          entries: result.data.entries.length,
          balances: result.data.balances.length,
          duplicates: result.duplicates,
        },
        conflicts: result.conflicts,
        owners: result.data.people,
      },
      null,
      2,
    ),
  );
  console.log(
    `Normalized ${result.data.entries.length} monthly entries and ${result.data.balances.length} balances; ${result.conflicts.length} CSV conflicts require review.`,
  );
  if (result.conflicts.length) process.exitCode = 2;
}
if (process.argv[1]?.endsWith("normalize.ts"))
  void main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : "Normalization failed");
    process.exitCode = 1;
  });
