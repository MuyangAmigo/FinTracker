"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { uploadCsvAction, type UploadResult } from "./actions";

export function UploadForm() {
  const [state, formAction, pending] = useActionState<UploadResult | null, FormData>(
    uploadCsvAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="font-micro-cap text-on-primary/60">CSV file</span>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="font-body-md mt-2 block w-full rounded-md border border-white/10 bg-canvas/5 px-3 py-2 text-on-primary file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary file:hover:bg-primary-soft/80"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button variant="onDark" type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload & stage"}
        </Button>
        {state && !state.ok ? (
          <p className="font-body-md text-error">{state.error}</p>
        ) : null}
      </div>
      <p className="font-micro text-on-primary/50">
        Files stay private to your household. Nothing lands in canonical tables
        until you click <span className="text-on-primary/80">Commit</span> on the
        review page.
      </p>
    </form>
  );
}
