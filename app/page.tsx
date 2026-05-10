import Link from "next/link";
import { GradientMesh } from "@/components/marketing/gradient-mesh";
import { MarketingNavBar } from "@/components/marketing/nav-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PillTag } from "@/components/ui/pill-tag";
import { Money } from "@/components/ui/money";

/*
 * Marketing landing page — applies the Stripi-inspired language from DESIGN.md:
 *   - Gradient-mesh hero on the upper third.
 *   - Single-indigo CTA hierarchy (one filled pill per band).
 *   - Sohne-substitute (Inter) thin display type with negative tracking.
 *   - Tabular-figure money cells in the dashboard preview.
 *   - Cream-band feature card as a chromatic interlude.
 *   - Composited dashboard mockup with Level-2 floating shadow.
 */
export default function MarketingHome() {
  return (
    <main className="flex flex-1 flex-col">
      <GradientMesh>
        <MarketingNavBar />
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-col gap-6">
              <PillTag>Household finance, for two.</PillTag>
              <h1 className="font-display-xxl text-ink">
                Your household finances,
                <br />
                quietly under control.
              </h1>
              <p className="font-body-lg max-w-md text-ink-secondary">
                FinTracker replaces the Excel ritual with a secure, shared
                workspace for income, expenses, balances, and investments —
                with Azure-AI insights when you ask for them.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/dashboard">
                  <Button size="lg">Open dashboard</Button>
                </Link>
                <Link href="#analysis" className="font-body-md text-primary">
                  See the analysis →
                </Link>
              </div>
            </div>

            <DashboardPreview />
          </div>
        </section>
      </GradientMesh>

      <section id="product" className="bg-canvas-soft px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <p className="font-micro-cap mb-3 text-primary-deep">Product</p>
            <h2 className="font-display-lg text-ink">
              One place for the household ledger, the balances, and the goals.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card variant="featureLight">
              <h3 className="font-heading-md mb-2 text-ink">Quick entry</h3>
              <p className="font-body-md text-ink-mute">
                Capture income, expenses, transfers, balances, and investment
                snapshots without leaving the keyboard.
              </p>
            </Card>
            <Card variant="featureLight">
              <h3 className="font-heading-md mb-2 text-ink">
                Net-worth snapshots
              </h3>
              <p className="font-body-md text-ink-mute">
                Monthly balances across cash, banks, brokerage, ESPP, and
                insurance — with full account history.
              </p>
            </Card>
            <Card variant="featureLight">
              <h3 className="font-heading-md mb-2 text-ink">Budgets and goals</h3>
              <p className="font-body-md text-ink-mute">
                Track the household savings rate against the 60% goal and stay
                ahead of category drift each month.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section id="analysis" className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-micro-cap mb-3 text-primary-deep">Analysis</p>
            <h2 className="font-display-lg mb-4 text-ink">
              Insight that explains itself.
            </h2>
            <p className="font-body-lg text-ink-secondary">
              Deterministic metrics first — savings rate, burn rate, category
              variance, net-worth growth. Azure-hosted models add the
              narrative, the anomalies, and the recommendations.
            </p>
          </div>

          <Card variant="creamBand">
            <p className="font-micro-cap mb-3 text-lemon">May 2026 summary</p>
            <p className="font-heading-lg text-ink">
              Household saved 67% — three points above the goal. Lifestyle
              spend rose due to the Thailand trip, offset by lower utilities.
            </p>
            <p className="font-body-md mt-4 text-ink-mute">
              Powered by your Azure AI Foundry model deployment.
            </p>
          </Card>
        </div>
      </section>

      <section id="security" className="bg-canvas-soft px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <p className="font-micro-cap mb-3 text-primary-deep">Security</p>
            <h2 className="font-display-lg text-ink">
              Built for a household, locked down for a treasury.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card variant="featureLight">
              <h3 className="font-heading-md mb-2 text-ink">
                Microsoft Entra sign-in
              </h3>
              <p className="font-body-md text-ink-mute">
                MFA and passkey support out of the box. No local password
                database to compromise.
              </p>
            </Card>
            <Card variant="featureLight">
              <h3 className="font-heading-md mb-2 text-ink">
                Household scoping
              </h3>
              <p className="font-body-md text-ink-mute">
                Every record is scoped to your household. Azure-managed
                identity guards the database and storage.
              </p>
            </Card>
            <Card variant="featureLight">
              <h3 className="font-heading-md mb-2 text-ink">
                Aggregates-first AI
              </h3>
              <p className="font-body-md text-ink-mute">
                Models receive aggregate metrics by default. Raw records stay
                inside your tenant unless you opt in.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline bg-canvas px-6 py-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-center font-caption text-ink-mute md:text-left">
          <span>FinTracker — household finance for Junjie & Jin You.</span>
          <span>Hosted on Azure. Built with Next.js.</span>
        </div>
      </footer>
    </main>
  );
}

function DashboardPreview() {
  return (
    <Card variant="dashboardMockup" padding="md" className="p-6">
      <div className="flex items-center justify-between">
        <p className="font-micro-cap text-ink-mute">May 2026 · Household</p>
        <PillTag>Live</PillTag>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat
          label="Income"
          value={{ amountMinor: 9_876_500, currency: "CNY" }}
        />
        <Stat
          label="Expenses"
          value={{ amountMinor: 3_241_900, currency: "CNY" }}
        />
        <Stat
          label="Net"
          value={{ amountMinor: 6_634_600, currency: "CNY" }}
        />
      </div>
      <div className="mt-6 rounded-md bg-canvas-soft p-4">
        <p className="font-micro-cap mb-3 text-ink-mute">Top categories</p>
        <ul className="font-body-tabular space-y-2 text-ink">
          <li className="flex items-center justify-between">
            <span>恋爱金</span>
            <Money value={{ amountMinor: 980_000, currency: "CNY" }} />
          </li>
          <li className="flex items-center justify-between">
            <span>玩乐金 — 泰国</span>
            <Money value={{ amountMinor: 1_452_300, currency: "CNY" }} />
          </li>
          <li className="flex items-center justify-between">
            <span>冤大头 — 物业</span>
            <Money value={{ amountMinor: 426_800, currency: "CNY" }} />
          </li>
        </ul>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: { amountMinor: number; currency: string };
}) {
  return (
    <div className="rounded-md bg-canvas-soft p-3">
      <p className="font-micro-cap text-ink-mute">{label}</p>
      <Money className="font-heading-md mt-1 text-ink" value={value} />
    </div>
  );
}
