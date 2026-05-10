import Link from "next/link";

import { GradientMesh } from "@/components/marketing/gradient-mesh";
import { MarketingNavBar } from "@/components/marketing/nav-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signIn, auth } from "@/auth";

/*
 * Sign-in page. The actual authentication happens via the server action
 * below — Auth.js handles the redirect to Microsoft and the callback.
 *
 * The household allowlist (lib/auth/allowlist.ts) decides who's allowed
 * after Microsoft confirms identity; rejected users land on /auth-error.
 */

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const target = callbackUrl ?? "/dashboard";

  return (
    <GradientMesh className="flex min-h-screen flex-col">
      <MarketingNavBar />
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <Card variant="featureLight" className="w-full max-w-md">
          <h1 className="font-display-md text-ink">Sign in</h1>
          <p className="font-body-md mt-2 text-ink-mute">
            FinTracker uses Microsoft Entra for authentication. Only invited
            household members can access the dashboard.
          </p>

          {session?.user ? (
            <div className="mt-8 flex flex-col gap-3">
              <p className="font-body-md text-ink">
                Signed in as{" "}
                <strong className="text-ink">{session.user.email}</strong>
              </p>
              <Link href="/dashboard">
                <Button>Continue to dashboard</Button>
              </Link>
            </div>
          ) : (
            <form
              className="mt-8 flex flex-col gap-3"
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", { redirectTo: target });
              }}
            >
              <Button type="submit">Continue with Microsoft</Button>
            </form>
          )}
        </Card>
      </main>
    </GradientMesh>
  );
}
