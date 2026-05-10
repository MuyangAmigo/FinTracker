import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * pill-tag-soft per DESIGN.md — subdued indigo tag for category / context labels.
 * Background uses primary-subdued (the brand's pale indigo wash).
 */
export type PillTagProps = React.HTMLAttributes<HTMLSpanElement>;

export const PillTag = React.forwardRef<HTMLSpanElement, PillTagProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-pill bg-primary-subdued px-2 py-1 font-micro-cap text-primary-deep",
        className,
      )}
      {...props}
    />
  ),
);
PillTag.displayName = "PillTag";
