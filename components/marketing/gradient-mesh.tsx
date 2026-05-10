import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * GradientMesh — atmospheric backdrop for the upper third of marketing pages.
 *
 * DESIGN.md requires a gradient mesh on every marketing hero ("bare-canvas
 * heroes break the brand"). This component is the v1 CSS approximation
 * implemented via stacked radial gradients in `globals.css` (`.bg-mesh-hero`).
 * Replace the inner background with an SVG mesh later for organic blob shapes
 * matching the production design.
 */
export function GradientMesh({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative isolate overflow-hidden bg-mesh-hero", className)}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-canvas"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
