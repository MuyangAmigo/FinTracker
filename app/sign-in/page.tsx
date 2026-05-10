import Link from "next/link";
import { GradientMesh } from "@/components/marketing/gradient-mesh";
import { MarketingNavBar } from "@/components/marketing/nav-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/*
 * Sign-in placeholder. Real Microsoft Entra (Auth.js v5) integration arrives
 * in Phase 2 (security-household). For now this is a static landing surface
 * that proves the design system and routing wire-up.
 */
export default function SignInPage() {
  return (
    <GradientMesh className="flex min-h-screen flex-col">
      <MarketingNavBar />
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <Card variant="featureLight" className="w-full max-w-md">
          <h1 className="font-display-md text-ink">Sign in</h1>
          <p className="font-body-md mt-2 text-ink-mute">
            FinTracker uses Microsoft Entra for authentication. Single sign-on
            with MFA / passkeys will be enabled in Phase 2.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Button disabled>Continue with Microsoft</Button>
            <Link
              href="/dashboard"
              className="font-body-md text-center text-primary"
            >
              Continue to dashboard preview
            </Link>
          </div>
        </Card>
      </main>
    </GradientMesh>
  );
}
