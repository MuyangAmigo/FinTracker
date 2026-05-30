"use client";

import { useActionState, useState } from "react";

import {
  recordInsightFeedbackAction,
  type FeedbackActionResult,
} from "@/app/dashboard/insights/actions";

/*
 * Per-insight feedback strip — thumbs up / thumbs down plus an optional
 * free-form note. Uses Auth.js v5 server actions through
 * `useActionState`, so the button row works without JS hydration too
 * (progressive enhancement) but gets a nicer UX with it.
 */

export function InsightFeedback({
  insightId,
  initialRating,
  initialNote,
}: {
  insightId: string;
  initialRating: number;
  initialNote: string | null;
}) {
  const [state, formAction, isPending] = useActionState<
    FeedbackActionResult | null,
    FormData
  >(recordInsightFeedbackAction, null);
  const [rating, setRating] = useState<number>(initialRating);
  const [note, setNote] = useState<string>(initialNote ?? "");

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
      <input type="hidden" name="insightId" value={insightId} />
      <input type="hidden" name="rating" value={String(rating)} />
      <div className="flex items-center gap-1">
        <button
          type="submit"
          aria-pressed={rating === 1}
          onClick={() => setRating(1)}
          disabled={isPending}
          className={
            rating === 1
              ? "rounded-pill border border-primary bg-primary/15 px-3 py-1 font-button-sm text-primary"
              : "rounded-pill border border-white/15 px-3 py-1 font-button-sm text-on-primary/70 hover:bg-white/5"
          }
        >
          👍 Helpful
        </button>
        <button
          type="submit"
          aria-pressed={rating === -1}
          onClick={() => setRating(-1)}
          disabled={isPending}
          className={
            rating === -1
              ? "rounded-pill border border-ruby bg-ruby/15 px-3 py-1 font-button-sm text-ruby"
              : "rounded-pill border border-white/15 px-3 py-1 font-button-sm text-on-primary/70 hover:bg-white/5"
          }
        >
          👎 Off-base
        </button>
      </div>
      <input
        type="text"
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for next iteration"
        className="min-w-[18rem] flex-1 rounded-md border border-white/15 bg-transparent px-3 py-1.5 font-body-sm text-on-primary placeholder:text-on-primary/40"
        maxLength={500}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-pill bg-white/5 px-3 py-1 font-button-sm text-on-primary/80 hover:bg-white/10 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {state && !state.ok ? (
        <span className="font-body-sm text-ruby">{state.error}</span>
      ) : null}
      {state?.ok ? (
        <span className="font-body-sm text-primary-soft">Saved.</span>
      ) : null}
    </form>
  );
}
