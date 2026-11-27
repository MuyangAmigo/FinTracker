"use client";
import dynamic from "next/dynamic";
import { BootLoading, type FinancePage } from "./loading-state";
const Client = dynamic(
  () => import("./finance-app").then((module) => module.FinanceApp),
  {
    ssr: false,
    loading: () => <BootLoading />,
  },
);
export function FinanceClient({ page }: { page: FinancePage }) {
  return <Client page={page} />;
}
