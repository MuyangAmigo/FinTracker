"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/snapshots", label: "Snapshots" },
  { href: "/dashboard/budgets", label: "Budgets" },
  { href: "/dashboard/analysis", label: "Analysis" },
  { href: "/dashboard/accounts", label: "Accounts" },
  { href: "/dashboard/insights", label: "Insights" },
  { href: "/dashboard/imports", label: "Imports" },
  { href: "/dashboard/audit", label: "Audit" },
];

export function DashboardSidebarNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="mt-10 flex flex-1 flex-col gap-2 font-body-md text-on-primary/70">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-md bg-white/10 px-3 py-2 text-on-primary"
                : "rounded-md px-3 py-2 hover:bg-white/5 hover:text-on-primary"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
