import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PillTag } from "@/components/ui/pill-tag";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

const HOUSEHOLD_ID = "junyou-household";

export default async function ImportsIndexPage() {
  await requireSession();

  const imports = await prisma.import.findMany({
    where: { householdId: HOUSEHOLD_ID },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { rows: true } } },
  });

  return (
    <div className="bg-app-shell min-h-screen p-6 text-on-primary md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <PillTag>Imports</PillTag>
          <h1 className="font-display-lg mt-3 text-on-primary">Bring in your data</h1>
          <p className="font-body-md mt-1 text-on-primary/70">
            Upload a CSV from your spreadsheet, review the parsed rows, then
            commit them to your household ledger.
          </p>
        </header>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="mb-10 bg-brand-dark-900/60 text-on-primary"
        >
          <h2 className="font-heading-md mb-4">Upload a CSV</h2>
          <UploadForm />
        </Card>

        <section>
          <h2 className="font-heading-md mb-3 text-on-primary">Recent uploads</h2>
          {imports.length === 0 ? (
            <Card
              variant="dashboardMockup"
              padding="md"
              className="bg-brand-dark-900/40 text-on-primary/70"
            >
              <p className="font-body-md">
                No imports yet. Drop a CSV above to get started.
              </p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {imports.map((imp) => (
                <li key={imp.id}>
                  <Link
                    href={`/dashboard/imports/${imp.id}`}
                    className="block rounded-lg border border-white/10 bg-brand-dark-900/40 p-4 hover:bg-brand-dark-900/60"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-heading-sm truncate text-on-primary">
                          {imp.filename}
                        </p>
                        <p className="font-micro mt-1 text-on-primary/60">
                          {imp.format} ·{" "}
                          {imp.coversFrom?.toISOString().slice(0, 10) ?? "—"} →{" "}
                          {imp.coversTo?.toISOString().slice(0, 10) ?? "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-body-tabular text-on-primary">
                          {imp._count.rows} rows
                        </p>
                        <p className="font-micro-cap mt-1 text-on-primary/60">
                          {imp.status}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
