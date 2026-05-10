import Link from "next/link";
import { Button } from "@/components/ui/button";

/*
 * MarketingNavBar — top navigation that floats over the gradient mesh.
 *
 * Per DESIGN.md `nav-bar-on-mesh`:
 *   - Background: canvas (or transparent depending on scroll).
 *   - Padding: 16px 24px.
 *   - Logo wordmark left, primary nav center, sign-in + filled CTA right.
 */
export function MarketingNavBar() {
  return (
    <header className="px-6 py-4">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-pill border border-hairline/60 bg-canvas/80 px-4 py-2 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 font-heading-sm text-ink">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-pill bg-primary"
          />
          FinTracker
        </Link>
        <div className="hidden items-center gap-6 font-body-md text-ink-mute md:flex">
          <Link href="#product" className="hover:text-ink">
            Product
          </Link>
          <Link href="#analysis" className="hover:text-ink">
            Analysis
          </Link>
          <Link href="#security" className="hover:text-ink">
            Security
          </Link>
          <Link href="/dashboard" className="hover:text-ink">
            Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="font-body-md text-ink-mute hover:text-ink"
          >
            Sign in
          </Link>
          <Link href="/dashboard">
            <Button>Open dashboard</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
