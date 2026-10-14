import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  datasetSchema,
  validateRelations,
  type Dataset,
} from "../../shared/import-schema.js";
import { monthEnd } from "../../shared/finance.js";

export async function loadDataset(db: PrismaClient, data: Dataset) {
  validateRelations(data);
  const householdId = data.household.id;
  const editedMonths = new Set(
    (
      await db.monthPeriod.findMany({
        where: { householdId, version: { gt: 0 } },
        select: { month: true },
      })
    ).map((p) => p.month),
  );
  await db.household.upsert({
    where: { id: householdId },
    create: data.household,
    update: {},
  });
  for (const person of data.people)
    await db.person.upsert({
      where: { id: person.id },
      create: { ...person, householdId },
      update: {},
    });
  for (const account of data.accounts) {
    await db.account.createMany({
      data: [{ ...account, householdId }],
      skipDuplicates: true,
    });
    await db.account.updateMany({
      where: { id: account.id, householdId, version: 0 },
      data: account,
    });
  }
  for (const line of data.lines)
    await db.ledgerLine.upsert({
      where: { id: line.id },
      create: { ...line, householdId },
      update: {},
    });
  for (const period of data.periods) {
    await db.monthPeriod.upsert({
      where: { householdId_month: { householdId, month: period.month } },
      create: { ...period, householdId },
      update: {},
    });
    await db.monthPeriod.updateMany({
      where: { householdId, month: period.month, version: 0 },
      data: period,
    });
  }
  for (const entry of data.entries) {
    if (editedMonths.has(entry.month)) continue;
    const record = {
      ...entry,
      amountMinor: BigInt(entry.amountMinor),
      householdId,
      author: "private-import",
    };
    await db.monthlyEntry.createMany({ data: [record], skipDuplicates: true });
    await db.monthlyEntry.updateMany({
      where: {
        householdId,
        lineId: entry.lineId,
        month: entry.month,
        manuallyEdited: false,
      },
      data: record,
    });
  }
  for (const balance of data.balances) {
    const record = {
      ...balance,
      amountMinor: BigInt(balance.amountMinor),
      householdId,
      author: "private-import",
    };
    await db.assetBalance.createMany({ data: [record], skipDuplicates: true });
    await db.assetBalance.updateMany({
      where: {
        householdId,
        accountId: balance.accountId,
        asOf: balance.asOf,
        manuallyEdited: false,
      },
      data: record,
    });
  }
  for (const reference of data.references)
    await db.sourceReference.upsert({
      where: { id: reference.id },
      create: {
        ...reference,
        householdId,
        valueMinor: reference.valueMinor === null ? null : BigInt(reference.valueMinor),
      },
      update: {},
    });
}
export function reconcile(data: Dataset) {
  const kinds = new Map(data.lines.map((l) => [l.id, l.kind]));
  return data.references
    .filter((r) => r.valueMinor !== null)
    .map((reference) => {
      let actual: bigint | null = null;
      if (/^(MONTH|ANNUAL)_(INCOME|EXPENSE)$/.test(reference.kind)) {
        const kind = reference.kind.endsWith("INCOME") ? "INCOME" : "EXPENSE";
        actual = data.entries
          .filter(
            (e) => e.month.startsWith(reference.period) && kinds.get(e.lineId) === kind,
          )
          .reduce((v, e) => v + BigInt(e.amountMinor), 0n);
      } else if (
        reference.kind === "Grand Total" ||
        reference.kind === "Household Total"
      ) {
        const asOf = monthEnd(reference.period),
          latest = new Map<string, Dataset["balances"][number]>();
        for (const balance of data.balances)
          if (
            (reference.kind === "Household Total" ||
              balance.ownerId === reference.ownerId) &&
            balance.asOf <= asOf &&
            (!latest.has(balance.accountId) ||
              latest.get(balance.accountId)!.asOf < balance.asOf)
          )
            latest.set(balance.accountId, balance);
        const householdSummary =
          reference.source === "provided-household-asset-screenshot";
        const assetIds = new Set(
          data.accounts
            .filter(
              (a) => householdSummary || (a.type !== "PROPERTY" && a.type !== "VEHICLE"),
            )
            .map((a) => a.id),
        );
        actual = [...latest.values()]
          .filter((b) => assetIds.has(b.accountId))
          .reduce((v, b) => v + BigInt(b.amountMinor), 0n);
      }
      return {
        source: reference.source,
        kind: reference.kind,
        period: reference.period,
        ownerId: reference.ownerId,
        expectedMinor: reference.valueMinor,
        actualMinor: actual?.toString() ?? null,
        differenceMinor:
          actual === null ? null : (actual - BigInt(reference.valueMinor!)).toString(),
      };
    });
}
async function main() {
  const args = process.argv.slice(2),
    input = args[args.indexOf("--input") + 1],
    report = args[args.indexOf("--report") + 1];
  if (!args.includes("--input") || !args.includes("--report"))
    throw new Error("Use --input PRIVATE_DATASET.json --report PRIVATE_REPORT.json");
  for (const path of [input, report]) {
    const rel = relative(process.cwd(), resolve(path));
    if (!rel.startsWith("..") && !isAbsolute(rel))
      throw new Error("Import files must be outside the public repository");
  }
  const data = datasetSchema.parse(JSON.parse(readFileSync(input, "utf8")));
  validateRelations(data);
  const reconciliation = reconcile(data);
  writeFileSync(report, JSON.stringify(reconciliation, null, 2));
  if (args.includes("--check-only")) {
    console.log(
      `Checked ${reconciliation.length} source references; report saved privately.`,
    );
    return;
  }
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required; no records were loaded");
  const db = new PrismaClient();
  try {
    await loadDataset(db, data);
    console.log(
      `Imported ${data.entries.length} monthly entries and ${data.balances.length} balances.`,
    );
  } finally {
    await db.$disconnect();
  }
}
if (process.argv[1]?.endsWith("import.ts"))
  void main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : "Import failed");
    process.exitCode = 1;
  });
