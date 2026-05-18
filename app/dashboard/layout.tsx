import Link from "next/link";

import { signOut } from "@/auth";
import { requireSession } from "@/lib/auth/session";

import { DashboardSidebarNav } from "@/components/dashboard/sidebar-nav";

/*
 * Shared dashboard chrome.
 *
 * Phase 5 lifted the sidebar out of /dashboard/page.tsx so every sub-route
 * (transactions, snapshots, budgets, imports, audit) inherits the same nav.
 * The sidebar itself is a client component so it can highlight the active
 * link via usePathname().
 */

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const user = session.user;
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
        <DashboardSidebarNav />
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

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
