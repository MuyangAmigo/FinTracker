import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PillTag } from "@/components/ui/pill-tag";
import { CURRENT_HOUSEHOLD_ID } from "@/lib/auth/household";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPE_FILTERS: { label: string; value?: string }[] = [
  { label: "All" },
  { label: "Finance writes", value: "finance.write" },
  { label: "Imports", value: "import" },
  { label: "Logins", value: "login" },
  { label: "Login denied", value: "login_denied" },
  { label: "Sign-out", value: "signout" },
  { label: "Admin", value: "admin.settings" },
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const typeFilter = sp.type?.trim() || undefined;

  const events = typeFilter
    ? await prisma.auditEvent.findMany({
        where: { householdId: CURRENT_HOUSEHOLD_ID, type: typeFilter },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    : await prisma.auditEvent.findMany({
        where: { householdId: CURRENT_HOUSEHOLD_ID },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <PillTag>Audit</PillTag>
          <h1 className="font-display-md mt-3 text-on-primary">Activity log</h1>
          <p className="font-body-md mt-1 text-on-primary/70">
            Most recent 200 events. Read-only.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {TYPE_FILTERS.map((f) => {
            const active = (typeFilter ?? undefined) === f.value;
            const href = f.value
              ? `/dashboard/audit?type=${encodeURIComponent(f.value)}`
              : `/dashboard/audit`;
            return (
              <Link
                key={f.label}
                href={href}
                className={
                  active
                    ? "rounded-pill bg-primary px-3 py-1 font-button-sm text-on-primary"
                    : "rounded-pill border border-white/10 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/5"
                }
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <Card
          variant="dashboardMockup"
          padding="lg"
          className="bg-brand-dark-900/60 text-on-primary"
        >
          {events.length === 0 ? (
            <p className="font-body-md text-on-primary/70">
              No audit events recorded yet for this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="font-body-md min-w-full text-left text-on-primary">
                <thead className="font-micro-cap text-on-primary/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4">When (UTC)</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Actor</th>
                    <th className="py-2 pr-4">Resource</th>
                    <th className="py-2 pr-4">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-white/5">
                      <td className="py-2 pr-4 tabular-money text-on-primary/80">
                        {e.createdAt
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}
                      </td>
                      <td className="font-micro-cap py-2 pr-4 text-on-primary/80">
                        {e.type}
                      </td>
                      <td className="py-2 pr-4">
                        {e.actorEmail ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-on-primary/70">
                        {e.resource ?? "—"}
                      </td>
                      <td className="font-body-md max-w-md py-2 pr-4 text-on-primary/70">
                        <span className="block truncate">
                          {formatMetadata(e.metadata)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

function formatMetadata(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "(unserialisable)";
  }
}
