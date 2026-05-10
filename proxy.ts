import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";

/*
 * Next.js 16 proxy (formerly middleware).
 *
 * Two modes:
 *
 * 1. **Phase 8a temporary mode** — when `BASIC_AUTH_PASSWORD` is set in the
 *    environment, every request is gated at the edge by HTTP Basic Auth using
 *    a single shared credential (Junjie + Jin You share one password). The
 *    `AUTH_BYPASS=true` env in `lib/auth/session.ts` then makes server
 *    components skip the NextAuth check and act as a stub "household" user.
 *    This lets us deploy live before a real Entra app registration exists.
 *
 * 2. **Production mode** — when `BASIC_AUTH_PASSWORD` is not set, falls back
 *    to the original NextAuth (Microsoft Entra) flow: `/dashboard/*` and
 *    finance APIs require a valid session; everything else is public.
 */

const PROTECTED_PREFIXES = ["/dashboard"];
const PROTECTED_API_PREFIXES = ["/api/finance", "/api/insights", "/api/imports"];
const BASIC_AUTH_PUBLIC_PATHS = new Set<string>(["/api/health"]);

function basicAuthGate(req: NextRequest, expectedPassword: string): NextResponse {
  if (BASIC_AUTH_PUBLIC_PATHS.has(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const expectedUser = process.env.BASIC_AUTH_USER ?? "household";
  const header = req.headers.get("authorization");
  const reject = () =>
    new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="FinTracker", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  if (!header || !header.toLowerCase().startsWith("basic ")) {
    return reject();
  }
  let decoded: string;
  try {
    decoded = atob(header.slice("basic ".length).trim());
  } catch {
    return reject();
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return reject();
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  if (user !== expectedUser || pass !== expectedPassword) {
    return reject();
  }
  return NextResponse.next();
}

const nextAuthGate = auth((req) => {
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

export default function proxy(req: NextRequest) {
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;
  if (expectedPassword) {
    return basicAuthGate(req, expectedPassword);
  }
  // Cast: Auth.js's auth() wrapper accepts NextRequest at runtime even
  // though its narrower typed signature suggests otherwise.
  return (nextAuthGate as unknown as (req: NextRequest) => NextResponse | Promise<NextResponse>)(req);
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
