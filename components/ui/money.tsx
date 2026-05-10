import * as React from "react";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  type FormatMoneyOptions,
  type Money as MoneyValue,
} from "@/lib/money";

/*
 * Money — the canonical financial-data primitive.
 *
 * Renders as an <output> element so screen readers announce it as a result
 * value, and applies tabular figures (font-feature-settings: "tnum") per
 * DESIGN.md's "tabular-figure money type" signature.
 */
export interface MoneyProps
  extends Omit<React.HTMLAttributes<HTMLOutputElement>, "children"> {
  value: MoneyValue;
  formatOptions?: FormatMoneyOptions;
  /** Tone the value: positive (net), negative (debit), neutral (default). */
  tone?: "positive" | "negative" | "neutral";
}

export const Money = React.forwardRef<HTMLOutputElement, MoneyProps>(
  ({ value, formatOptions, tone = "neutral", className, ...props }, ref) => {
    const formatted = formatMoney(value, formatOptions);
    const toneClass =
      tone === "negative" ? "text-ruby" : "text-ink";
    return (
      <output
        ref={ref}
        className={cn("tabular-money font-body-tabular", toneClass, className)}
        {...props}
      >
        {formatted}
      </output>
    );
  },
);
Money.displayName = "Money";
