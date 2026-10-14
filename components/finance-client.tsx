"use client";
import dynamic from "next/dynamic";
const Client = dynamic(
  () => import("./finance-app").then((module) => module.FinanceApp),
  {
    ssr: false,
    loading: () => <main role="status">正在打开私人财务空间…</main>,
  },
);
export function FinanceClient({
  page,
}: {
  page: "dashboard" | "ledger" | "assets" | "accounts";
}) {
  return <Client page={page} />;
}
