import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Card variants per DESIGN.md (Components → Cards & Containers):
 *   - feature-light: white surface with hairline border, 32px padding.
 *   - pricing: white surface, hairline border, structured for tier display.
 *   - pricing-featured: brand-dark-900 fill, on-primary text — the brand's
 *     distinctive featured-tier choice.
 *   - cream-band: warm cream interlude card.
 *   - dashboard-mockup: composited dashboard with Level-2 floating shadow.
 *
 * Padding / radius are part of the brand and should not drift.
 */
const cardStyles = cva(
  "rounded-lg",
  {
    variants: {
      variant: {
        featureLight:
          "bg-canvas text-ink border border-hairline shadow-[0_1px_3px_rgba(0,55,112,0.08)]",
        pricing: "bg-canvas text-ink border border-hairline",
        pricingFeatured: "bg-brand-dark-900 text-on-primary border border-brand-dark-900",
        creamBand: "bg-canvas-cream text-ink",
        dashboardMockup:
          "bg-canvas text-ink shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)]",
      },
      padding: {
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "featureLight",
      padding: "lg",
    },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardStyles> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardStyles({ variant, padding }), className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const cardVariants = cardStyles;
