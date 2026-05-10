import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PillTag } from "@/components/ui/pill-tag";
import { Money } from "@/components/ui/money";
import { signOut } from "@/auth";
import { requireSession } from "@/lib/auth/session";

/*
 * Dashboard home. Per DESIGN.md the dashboard track flips polarity to a
 * dark-app shell (`bg-app-shell` from globals.css). Real data wiring comes
 * in Phase 5/6 — for now the placeholder KPIs and chart prove the design
 * system. Auth is enforced via `requireSession()` plus the middleware.
 */
export default async function DashboardHome() {
  const session = await requireSession();
  const user = session.user;
  const greetingName = user.name?.split(" ")[0] ?? user.email ?? "there";
  const role = user.householdRole === "owner" ? "Owner" : "Member";

  return (
    <div className="bg-app-shell flex min-h-screen flex-1 text-on-primary">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-brand-dark-900/40 p-6 md:flex">
        <Link href="/" className="font-heading-sm flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-pill bg-primary-soft"
          />
          FinTracker
        </Link>
        <nav className="mt-10 flex flex-1 flex-col gap-2 font-body-md text-on-primary/70">
          <DashNav href="/dashboard" label="Overview" active />
          <DashNav href="/dashboard/transactions" label="Transactions" />
          <DashNav href="/dashboard/accounts" label="Accounts" />
          <DashNav href="/dashboard/budgets" label="Budgets" />
          <DashNav href="/dashboard/insights" label="Insights" />
          <DashNav href="/dashboard/imports" label="Imports" />
        </nav>
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="font-micro-cap text-on-primary/50">Signed in</p>
          <p className="font-body-md mt-1 truncate text-on-primary">
            {user.email}
          </p>
          <p className="font-micro mt-1 text-on-primary/60">{role}</p>
          <form
            className="mt-3"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="font-body-md text-on-primary/70 hover:text-on-primary"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>


      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-5xl">
          <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <PillTag>Household · May 2026</PillTag>
              <h1 className="font-display-lg mt-3 text-on-primary">
                Welcome back, {greetingName}.
              </h1>
              <p className="font-body-md mt-1 text-on-primary/70">
                Real finance data lands in Phase 5/6. These cards are
                placeholders so the design system can be reviewed end-to-end.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="onDark">Add transaction</Button>
              <Button
                variant="secondary"
                className="border-white/20 bg-canvas/10 text-on-primary hover:bg-white/10"
              >
                Run insight
              </Button>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Income"
              value={{ amountMinor: 9_876_500, currency: "CNY" }}
            />
            <KpiCard
              label="Expenses"
              value={{ amountMinor: 3_241_900, currency: "CNY" }}
            />
            <KpiCard
              label="Savings"
              value={{ amountMinor: 6_634_600, currency: "CNY" }}
              accent
            />
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-3">
            <Card
              variant="dashboardMockup"
              padding="md"
              className="bg-brand-dark-900/60 text-on-primary lg:col-span-2"
            >
              <p className="font-micro-cap mb-3 text-on-primary/60">
                Net-worth trend (placeholder)
              </p>
              <div className="font-body-tabular flex h-48 items-end gap-1">
                {[24, 28, 31, 30, 33, 35, 38, 42, 45, 47, 51, 55].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-primary-soft/80"
                    style={{ height: `${h * 1.6}%` }}
                  />
                ))}
              </div>
            </Card>

            <Card
              variant="dashboardMockup"
              padding="md"
              className="bg-brand-dark-900/60 text-on-primary"
            >
              <p className="font-micro-cap mb-3 text-on-primary/60">
                Latest insight
              </p>
              <p className="font-heading-md text-on-primary">
                Savings rate is 67% — three points above goal.
              </p>
              <p className="font-body-md mt-3 text-on-primary/70">
                Generated by your Azure Foundry model deployment.
              </p>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}

function DashNav({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md bg-white/10 px-3 py-2 text-on-primary"
          : "rounded-md px-3 py-2 hover:bg-white/5 hover:text-on-primary"
      }
    >
      {label}
    </Link>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: { amountMinor: number; currency: string };
  accent?: boolean;
}) {
  return (
    <Card
      variant="dashboardMockup"
      padding="md"
      className={
        accent
          ? "bg-primary text-on-primary"
          : "bg-brand-dark-900/60 text-on-primary"
      }
    >
      <p className="font-micro-cap text-on-primary/70">{label}</p>
      <Money className="font-display-md mt-2 text-on-primary" value={value} />
    </Card>
  );
}
