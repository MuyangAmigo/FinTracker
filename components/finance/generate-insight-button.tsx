"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { generateInsightAction } from "@/app/dashboard/insights/actions";

/*
 * Pending-aware "Generate" button. Wraps the server action in
 * `useTransition` so the surrounding page can re-render with the new
 * insight without leaving the user staring at a frozen button.
 */
export function GenerateInsightButton({
  label = "Generate monthly summary",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="primary"
      disabled={isPending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          const result = await generateInsightAction();
          if (result.ok) {
            router.refresh();
          } else if (typeof window !== "undefined") {
            window.alert(`Insight generation failed: ${result.error}`);
          }
        });
      }}
    >
      {isPending ? "Generating…" : label}
    </Button>
  );
}
