import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PillTag } from "@/components/ui/pill-tag";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";

import { commitImportAction } from "../actions";

export const dynamic = "force-dynamic";

const PREVIEW_ROW_LIMIT = 100;

interface ParsedRowPayload {
  kind: "ACCOUNT_SNAPSHOT" | "TRANSACTION";
  accountName?: string;
  asOf?: string;
  occurredOn?: string;
  txnKind?: "INCOME" | "EXPENSE";
  label?: string;
  personTag?: "Junjie" | "Jinyou" | null;
  amountMinor: number;
  currency: string;
}

export default async function ImportReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const justCommitted = sp.committed === "1";

  const imp = await prisma.import.findFirst({
    where: { id, householdId: CURRENT_HOUSEHOLD_ID },
    include: {
      _count: { select: { rows: true } },
      rows: {
        orderBy: [{ sourceRow: "asc" }, { sourceColumn: "asc" }],
        take: PREVIEW_ROW_LIMIT,
      },
    },
  });
  if (!imp) notFound();

  const statusCounts = await prisma.importRow.groupBy({
    by: ["status"],
    where: { importId: id },
    _count: { _all: true },
  });
  const counts: Record<string, number> = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all]),
  );

  const totalRows = imp._count.rows;
  const previewRows = imp.rows;
  const isCommitted = imp.status === "COMMITTED";
  const formatLabel =
    imp.format === "PERSONAL_OVERVIEW"
      ? "Net-worth snapshots"
      : imp.format === "HOUSEHOLD_MONTHLY"
        ? "Monthly income / expense totals"
        : imp.format;

  return (
    <div className="bg-app-shell min-h-screen p-6 text-on-primary md:p-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard/imports"
          className="font-micro-cap text-on-primary/60 hover:text-on-primary"
        >
          ← Back to imports
        </Link>

        <header className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <PillTag>{formatLabel}</PillTag>
            <h1 className="font-display-md mt-3 truncate text-on-primary">
              {imp.filename}
            </h1>
            <p className="font-body-md mt-1 text-on-primary/70">
              {imp.coversFrom?.toISOString().slice(0, 10) ?? "—"} →{" "}
              {imp.coversTo?.toISOString().slice(0, 10) ?? "—"} · {totalRows} rows
              parsed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PillTag>{imp.status}</PillTag>
            {isCommitted ? (
              <p className="font-body-md text-on-primary/70">
                Already committed.
              </p>
            ) : (
              <form action={commitImportAction}>
                <input type="hidden" name="importId" value={imp.id} />
                <Button variant="onDark" type="submit">
                  Commit {totalRows} rows
                </Button>
              </form>
            )}
          </div>
        </header>

        {justCommitted ? (
          <Card
            variant="dashboardMockup"
            padding="md"
            className="mb-6 bg-primary text-on-primary"
          >
            <p className="font-heading-sm">Committed.</p>
            <p className="font-body-md mt-1 text-on-primary/80">
              Rows have been promoted into your ledger. Refresh the dashboard to
              see the new totals.
            </p>
          </Card>
        ) : null}

        <section className="mb-8 grid gap-3 md:grid-cols-4">
          <StatusCard label="Parsed" value={counts.PARSED ?? 0} />
          <StatusCard label="Mapped" value={counts.MAPPED ?? 0} />
          <StatusCard label="Committed" value={counts.COMMITTED ?? 0} />
          <StatusCard label="Errors" value={counts.ERROR ?? 0} accent="error" />
        </section>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="font-heading-md">Preview</h2>
            <p className="font-micro text-on-primary/60">
              Showing {previewRows.length} of {totalRows} rows
            </p>
          </header>

          <div className="overflow-x-auto">
            <table className="font-body-md min-w-full text-left text-on-primary">
              <thead className="font-micro-cap text-on-primary/60">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Kind</th>
                  <th className="py-2 pr-4">Account / Label</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => {
                  const p = (row.parsed ?? null) as ParsedRowPayload | null;
                  const date = p?.asOf ?? p?.occurredOn ?? "—";
                  const kind = p?.kind === "ACCOUNT_SNAPSHOT" ? "Snapshot" : p?.txnKind ?? "—";
                  const label = p?.accountName ?? p?.label ?? row.originalLabel ?? "—";
                  return (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="font-micro py-2 pr-4 text-on-primary/60">
                        r{row.sourceRow}{" "}
                        {row.sourceColumn ? `· ${row.sourceColumn}` : ""}
                      </td>
                      <td className="py-2 pr-4">{date}</td>
                      <td className="font-micro-cap py-2 pr-4 text-on-primary/70">
                        {kind}
                      </td>
                      <td className="max-w-xs truncate py-2 pr-4">
                        {label}
                        {p?.personTag ? (
                          <span className="font-micro ml-2 text-on-primary/50">
                            · {p.personTag}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {p ? (
                          <Money
                            value={{
                              amountMinor: p.amountMinor,
                              currency: p.currency,
                            }}
                          />
                        ) : (
                          row.rawValue ?? "—"
                        )}
                      </td>
                      <td className="font-micro-cap py-2 pr-4">
                        {row.status}
                        {row.errorMessage ? (
                          <span
                            className="ml-2 text-error"
                            title={row.errorMessage}
                          >
                            ⚠
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "error";
}) {
  return (
    <Card
      variant="dashboardMockup"
      padding="md"
      className={
        accent === "error" && value > 0
          ? "bg-error/20 text-on-primary"
          : "bg-brand-dark-900/40 text-on-primary"
      }
    >
      <p className="font-micro-cap text-on-primary/60">{label}</p>
      <p className="font-display-md mt-1 text-on-primary">{value}</p>
    </Card>
  );
}
