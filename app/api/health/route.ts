import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Liveness + DB reachability probe used by Azure App Service health checks
 * and the Basic Auth middleware allowlist.
 */
export async function GET() {
  try {
    await prisma.$queryRawUnsafe<{ ok: number }[]>("SELECT 1 AS ok");
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "unreachable",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
