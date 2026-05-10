import NextAuth, { type DefaultSession } from "next-auth";
import "next-auth/jwt";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { isHouseholdMember, householdRoleFor } from "@/lib/auth/allowlist";
import { audit } from "@/lib/auth/audit";

/*
 * Auth.js v5 root configuration.
 *
 * Uses the Microsoft Entra ID provider (single tenant) with JWT sessions —
 * the database adapter and full household table arrive in Phase 3.
 *
 * Access control today: a small allowlist (env-driven) gates sign-in to the
 * two household members. Everything below `/dashboard` requires a session via
 * `middleware.ts`. Server code should call `auth()` and additionally check
 * `session.user.householdRole` before exposing finance data.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      householdRole: "owner" | "member";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    householdRole?: "owner" | "member";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`
        : undefined,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
    error: "/auth-error",
  },
  callbacks: {
    async signIn({ user, profile }) {
      const email = (user.email ?? profile?.email ?? "").toLowerCase();
      if (!email) {
        audit({ type: "login_denied", actor: null, metadata: { reason: "no_email" } });
        return false;
      }
      if (!isHouseholdMember(email)) {
        audit({ type: "login_denied", actor: email, metadata: { reason: "not_in_allowlist" } });
        return false;
      }
      audit({ type: "login", actor: email, metadata: { role: householdRoleFor(email) } });
      return true;
    },
    async jwt({ token, user, profile }) {
      if (user || profile) {
        const email = (
          user?.email ??
          profile?.email ??
          (token.email as string | undefined) ??
          ""
        ).toLowerCase();
        token.householdRole = householdRoleFor(email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? session.user.email) as string;
        session.user.householdRole = token.householdRole ?? "member";
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      const actor =
        "token" in message && message.token?.email
          ? message.token.email
          : null;
      audit({ type: "signout", actor: actor as string | null });
    },
  },
});
