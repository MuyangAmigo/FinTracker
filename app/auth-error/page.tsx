import Link from "next/link";

import { GradientMesh } from "@/components/marketing/gradient-mesh";
import { MarketingNavBar } from "@/components/marketing/nav-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/*
 * Lands here when Auth.js rejects a sign-in. Common cases:
 *   - The Microsoft account isn't in the household allowlist
 *   - The Entra app is misconfigured (wrong tenant, redirect URI, etc.)
 *
 * Real error codes are in the `error` query param; we surface a friendly
 * message and a way back.
 */

type AuthErrorProps = {
  searchParams: Promise<{ error?: string }>;
};

const FRIENDLY: Record<string, string> = {
  AccessDenied:
    "Your Microsoft account isn't on the household allowlist. Ask the owner to invite you, then try again.",
  Configuration:
    "Authentication is misconfigured. Check the Entra app registration, tenant id, redirect URI, and AUTH_SECRET.",
  Verification:
    "We couldn't verify the sign-in attempt. The link may have expired — please try again.",
};

export default async function AuthErrorPage({ searchParams }: AuthErrorProps) {
  const { error } = await searchParams;
  const message =
    (error && FRIENDLY[error]) ??
    "Something went wrong while signing in. Please try again.";

  return (
    <GradientMesh className="flex min-h-screen flex-col">
      <MarketingNavBar />
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <Card variant="featureLight" className="w-full max-w-md">
          <h1 className="font-display-md text-ink">Sign-in problem</h1>
          <p className="font-body-md mt-2 text-ink-mute">{message}</p>
          {error ? (
            <p className="font-micro mt-4 text-ink-soft">Error code: {error}</p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/sign-in">
              <Button>Back to sign-in</Button>
            </Link>
            <Link
              href="/"
              className="font-body-md text-center text-primary"
            >
              Return to home
            </Link>
          </div>
        </Card>
      </main>
    </GradientMesh>
  );
}
