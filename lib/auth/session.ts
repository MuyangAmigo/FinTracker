import { redirect } from "next/navigation";

import { auth } from "@/auth";

/*
 * Server-side helpers around the Auth.js v5 session.
 * Use these in server components, server actions, and route handlers.
 *
 * `requireSession()` is the workhorse — it redirects unauthenticated
 * requests to /sign-in and returns a non-null session for the caller.
 *
 * Phase 8a temporary mode: when `AUTH_BYPASS=true` is set in the
 * environment, we return a stub "Household" session. This pairs with
 * the HTTP Basic Auth gate in `middleware.ts` so the live deploy works
 * before we wire up a real Entra app registration. Junjie and Jin You
 * are indistinguishable in this mode (single shared password) — the
 * audit log records both as `household@local`.
 */

const BYPASS_ENABLED = process.env.AUTH_BYPASS === "true";

const BYPASS_USER = {
  id: "household-bypass",
  name: "Household",
  email: "household@local",
  image: null,
  householdRole: "owner" as const,
};

export type SessionLike = {
  user: typeof BYPASS_USER | { id: string; name?: string | null; email?: string | null; householdRole: "owner" | "member" };
};

export async function requireSession() {
  if (BYPASS_ENABLED) {
    return { user: BYPASS_USER };
  }
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return session;
}

export async function getCurrentUser() {
  if (BYPASS_ENABLED) return BYPASS_USER;
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Like `auth()` but returns the bypass session when AUTH_BYPASS=true.
 * Use this in API routes that previously called `auth()` directly so
 * they get the same bypass behaviour as server components.
 */
export async function getApiSession() {
  if (BYPASS_ENABLED) {
    return { user: BYPASS_USER };
  }
  return auth();
}
