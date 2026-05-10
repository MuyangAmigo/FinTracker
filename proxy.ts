import { NextResponse } from "next/server";

import { auth } from "@/auth";

/*
 * Auth.js v5 middleware.
 *
 * Protects every route under `/dashboard` (and /api routes that aren't the
 * Auth.js handler itself). Public marketing routes (`/`, `/sign-in`,
 * `/auth-error`) are explicitly allowed.
 */

const PROTECTED_PREFIXES = ["/dashboard"];
const PROTECTED_API_PREFIXES = ["/api/finance", "/api/insights", "/api/imports"];

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthed = Boolean(req.auth?.user);

  const needsAuth =
    PROTECTED_PREFIXES.some((p) => nextUrl.pathname.startsWith(p)) ||
    PROTECTED_API_PREFIXES.some((p) => nextUrl.pathname.startsWith(p));

  if (needsAuth && !isAuthed) {
    const signInUrl = new URL("/sign-in", nextUrl);
    signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
