import { NextResponse } from "next/server";

import { getApiSession } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { detectImportFormat } from "@/lib/imports/format-detect";
import { parseHouseholdMonthly } from "@/lib/imports/parsers/household-monthly";
import { parsePersonalOverview } from "@/lib/imports/parsers/personal-overview";
import { stageImport } from "@/lib/imports/stage";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getApiSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing 'file' field" }, { status: 400 });
  }

  const filename = file.name || "upload.csv";
  const csvText = await file.text();

  const format = detectImportFormat(csvText);
  if (format === "UNKNOWN") {
    return NextResponse.json(
      { error: "unrecognised CSV format", filename },
      { status: 400 },
    );
  }

  const parsed =
    format === "PERSONAL_OVERVIEW"
      ? parsePersonalOverview(csvText)
      : parseHouseholdMonthly(csvText, { filename });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  const result = await stageImport({
    parsed,
    filename,
    submittedByUserId: user?.id ?? null,
  });

  audit({
    type: "import",
    actor: session.user.email,
    resource: result.importId,
    metadata: {
      filename,
      format,
      rowsStaged: result.rowsStaged,
      action: "stage",
    },
  });

  return NextResponse.json({
    importId: result.importId,
    rowsStaged: result.rowsStaged,
    format,
    coversFrom: parsed.coversFrom,
    coversTo: parsed.coversTo,
    notes: parsed.notes,
  });
}
