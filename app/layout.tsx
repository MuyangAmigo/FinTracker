import type { Metadata } from "next";
import { Figtree, Newsreader } from "next/font/google";
import { FinanceProvider } from "../components/finance-session";
import { preferencesInitScript } from "../lib/i18n";
import "./globals.css";

const enSans = Figtree({
  subsets: ["latin"],
  variable: "--font-en-sans",
  display: "swap",
});

const enSerif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-en-serif",
  display: "swap",
});

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
    <html
      lang="zh-CN"
      className={`${enSans.variable} ${enSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferencesInitScript }} />
      </head>
      <body>
        <FinanceProvider>{children}</FinanceProvider>
      </body>
    </html>
  );
}
