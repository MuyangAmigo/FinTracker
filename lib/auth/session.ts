import { redirect } from "next/navigation";

import { auth } from "@/auth";

/*
 * Server-side helpers around the Auth.js v5 session.
 * Use these in server components, server actions, and route handlers.
 *
 * `requireSession()` is the workhorse — it redirects unauthenticated
 * requests to /sign-in and returns a non-null session for the caller.
 */

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return session;
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
