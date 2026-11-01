import type { Metadata } from "next";
import { FinanceProvider } from "../components/finance-session";
import "./globals.css";
export const metadata: Metadata = {
  title: "FinTracker · 家庭财务",
  description: "简洁的家庭月度记账与资产管理",
  icons: {
    icon: {
      url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? "/FinTracker"}/favicon.png`,
      type: "image/png",
    },
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <FinanceProvider>{children}</FinanceProvider>
      </body>
    </html>
  );
}
