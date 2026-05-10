import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { audit } from "@/lib/auth/audit";
import { commitImport } from "@/lib/imports/stage";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  const summary = await commitImport(id);

  audit({
    type: "import",
    actor: session.user.email,
    resource: id,
    metadata: { action: "commit", ...summary },
  });

  return NextResponse.json(summary);
}
