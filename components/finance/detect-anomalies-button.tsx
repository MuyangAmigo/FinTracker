"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { detectAnomaliesAction } from "@/app/dashboard/insights/actions";

/*
 * Pending-aware "Detect anomalies" button. Mirrors GenerateInsightButton.
 * Surfaces the candidate count back to the user via a brief banner so
 * "0 anomalies" is obvious rather than looking like a failure.
 */
export function DetectAnomaliesButton({
  label = "Detect anomalies",
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
      variant="onDark"
      disabled={isPending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          const result = await detectAnomaliesAction();
          if (result.ok) {
            router.refresh();
            if (typeof window !== "undefined" && result.anomalyCount === 0) {
              window.alert(
                "Anomaly scan complete — no transactions exceeded the thresholds for this month.",
              );
            }
          } else if (typeof window !== "undefined") {
            window.alert(`Anomaly detection failed: ${result.error}`);
          }
        });
      }}
    >
      {isPending ? "Scanning…" : label}
    </Button>
  );
}
