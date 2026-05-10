"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { audit } from "@/lib/auth/audit";
import { prisma } from "@/lib/db";
import { detectImportFormat } from "@/lib/imports/format-detect";
import { parseHouseholdMonthly } from "@/lib/imports/parsers/household-monthly";
import { parsePersonalOverview } from "@/lib/imports/parsers/personal-overview";
import { commitImport, stageImport } from "@/lib/imports/stage";

export type UploadResult =
  | { ok: true; importId: string; rowsStaged: number }
  | { ok: false; error: string };

export async function uploadCsvAction(
  _prev: UploadResult | null,
  formData: FormData,
): Promise<UploadResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: "unauthenticated" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a CSV file first." };
  }

  const filename = file.name || "upload.csv";
  const csvText = await file.text();

  const format = detectImportFormat(csvText);
  if (format === "UNKNOWN") {
    return {
      ok: false,
      error:
        "Couldn't recognise this CSV. Expected a 'Finance YYYY - Overview' or 'Household Finance Management' file.",
    };
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
    metadata: { action: "stage", filename, format, rowsStaged: result.rowsStaged },
  });

  redirect(`/dashboard/imports/${result.importId}`);
}

export async function commitImportAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) return;
  const id = String(formData.get("importId") ?? "");
  if (!id) return;

  const summary = await commitImport(id);
  audit({
    type: "import",
    actor: session.user.email,
    resource: id,
    metadata: { action: "commit", ...summary },
  });
  redirect(`/dashboard/imports/${id}?committed=1`);
}
