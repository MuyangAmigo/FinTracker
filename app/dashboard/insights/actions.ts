"use server";

import { revalidatePath } from "next/cache";

import { getApiSession } from "@/lib/auth/session";
import {
  generateMonthlySummary,
  submitInsightFeedback,
} from "@/lib/ai/insights";

/*
 * Phase-7 insights server actions.
 *
 *   - `generateInsightAction` triggers a new monthly-summary run for the
 *     current calendar month. Successful runs invalidate the insights
 *     page + dashboard overview so the new card appears immediately.
 *   - `recordInsightFeedbackAction` records a thumbs ±1 (with optional
 *     note) on a specific insight. Used by the per-card feedback form.
 */

export type GenerateActionResult =
  | { ok: true; insightId: string; mock: boolean }
  | { ok: false; error: string };

export async function generateInsightAction(): Promise<GenerateActionResult> {
  const session = await getApiSession();
  if (!session?.user?.email) {
    return { ok: false, error: "unauthenticated" };
  }
  const outcome = await generateMonthlySummary({
    actorEmail: session.user.email,
  });
  revalidatePath("/dashboard/insights");
  revalidatePath("/dashboard");
  if (!outcome.ok) {
    return { ok: false, error: outcome.error };
  }
  return { ok: true, insightId: outcome.insightId, mock: outcome.mock };
}

export type FeedbackActionResult = { ok: true } | { ok: false; error: string };

export async function recordInsightFeedbackAction(
  _prev: FeedbackActionResult | null,
  formData: FormData,
): Promise<FeedbackActionResult> {
  const session = await getApiSession();
  if (!session?.user?.email) {
    return { ok: false, error: "unauthenticated" };
  }
  const insightId = String(formData.get("insightId") ?? "");
  const ratingStr = String(formData.get("rating") ?? "0");
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" ? noteRaw : null;
  const rating = Number(ratingStr);
  if (!insightId || Number.isNaN(rating)) {
    return { ok: false, error: "invalid input" };
  }
  const result = await submitInsightFeedback({
    insightId,
    rating,
    note,
    actorEmail: session.user.email,
  });
  revalidatePath("/dashboard/insights");
  return result;
}
