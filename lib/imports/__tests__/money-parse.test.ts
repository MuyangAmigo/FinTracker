import { describe, expect, it } from "vitest";

import { detectCurrency, parseMoneyCell } from "@/lib/imports/money-parse";

describe("parseMoneyCell", () => {
  it("parses CNY thousand-separated value", () => {
    expect(parseMoneyCell("¥321,373.49")).toBe(32137349);
  });

  it("parses zero", () => {
    expect(parseMoneyCell("¥0.00")).toBe(0);
    expect(parseMoneyCell("¥0.00 ")).toBe(0);
  });

  it("treats accounting parens as negative", () => {
    expect(parseMoneyCell("(¥547.40)")).toBe(-54740);
  });

  it("accepts leading minus", () => {
    expect(parseMoneyCell("-1234.56")).toBe(-123456);
    expect(parseMoneyCell("-¥1234.56")).toBe(-123456);
  });

  it("returns null for blanks and dashes", () => {
    expect(parseMoneyCell("")).toBeNull();
    expect(parseMoneyCell(null)).toBeNull();
    expect(parseMoneyCell(undefined)).toBeNull();
    expect(parseMoneyCell("-")).toBeNull();
    expect(parseMoneyCell("—")).toBeNull();
  });

  it("returns null for unparseable strings", () => {
    expect(parseMoneyCell("n/a")).toBeNull();
    expect(parseMoneyCell("abc")).toBeNull();
  });

  it("handles trailing whitespace and stray spaces", () => {
    expect(parseMoneyCell("  ¥1,200.00  ")).toBe(120000);
  });
});

describe("detectCurrency", () => {
  it("recognises the symbols we care about", () => {
    expect(detectCurrency("¥100")).toBe("CNY");
    expect(detectCurrency("$100")).toBe("USD");
    expect(detectCurrency("€100")).toBe("EUR");
    expect(detectCurrency("£100")).toBe("GBP");
    expect(detectCurrency("HKD 100")).toBe("HKD");
  });

  it("defaults to CNY", () => {
    expect(detectCurrency("100")).toBe("CNY");
    expect(detectCurrency(null)).toBe("CNY");
  });
});
