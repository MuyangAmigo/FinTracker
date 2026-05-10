import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Pill-shaped buttons, per DESIGN.md:
 *   - All buttons use {rounded.pill} (9999px) with 8px 16px padding.
 *   - Single-indigo CTA hierarchy: filled primary is the dominant call-to-action.
 *   - Secondary is canvas + 1px primary border.
 *   - On-dark variant for dashboard / brand-dark surfaces.
 *
 * Do NOT change the radius or padding without updating DESIGN.md first.
 */
const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-pill font-button-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary-deep active:bg-primary-press",
        secondary:
          "bg-canvas text-primary border border-primary hover:bg-primary-subdued/40",
        onDark:
          "bg-brand-dark-900 text-on-primary hover:bg-ink-secondary",
        ghost:
          "bg-transparent text-ink hover:bg-canvas-soft",
      },
      size: {
        sm: "px-3 py-1.5 font-button-sm",
        md: "px-4 py-2",
        lg: "px-5 py-2.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export const buttonVariants = buttonStyles;
