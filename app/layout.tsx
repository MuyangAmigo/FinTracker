import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FinTracker · 家庭财务",
  description: "简洁的家庭月度记账与资产管理",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
