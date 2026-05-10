/*
 * Currency / number formatting helpers.
 *
 * Money is represented internally as integer minor units (e.g. cents/jiao)
 * plus an ISO-4217 currency code. UI uses Intl.NumberFormat with the
 * locale-appropriate currency symbol and tabular figures via the
 * `font-body-tabular` / `tabular-money` classes from globals.css.
 */

export type Money = {
  amountMinor: number;
  currency: string;
};

const minorUnitFractionDigits: Record<string, number> = {
  CNY: 2,
  USD: 2,
  EUR: 2,
  HKD: 2,
  GBP: 2,
  JPY: 0,
  KRW: 0,
};

export function fractionDigitsForCurrency(currency: string): number {
  return minorUnitFractionDigits[currency.toUpperCase()] ?? 2;
}

export function toMajor(money: Money): number {
  const digits = fractionDigitsForCurrency(money.currency);
  return money.amountMinor / Math.pow(10, digits);
}

export function fromMajor(amount: number, currency: string): Money {
  const digits = fractionDigitsForCurrency(currency);
  return {
    amountMinor: Math.round(amount * Math.pow(10, digits)),
    currency,
  };
}

export type FormatMoneyOptions = {
  locale?: string;
  /** Show parenthesised negative for accounting style. Defaults to true. */
  accounting?: boolean;
  /** Always show sign for non-zero values. */
  signed?: boolean;
};

export function formatMoney(money: Money, opts: FormatMoneyOptions = {}): string {
  const { locale = "en-US", accounting = true, signed = false } = opts;
  const fractionDigits = fractionDigitsForCurrency(money.currency);
  const value = toMajor(money);

  const fmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    currencySign: accounting ? "accounting" : "standard",
    signDisplay: signed ? "exceptZero" : "auto",
  });

  return fmt.format(value);
}

export function formatPercent(
  ratio: number,
  opts: { locale?: string; fractionDigits?: number } = {},
): string {
  const { locale = "en-US", fractionDigits = 1 } = opts;
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}
