import { describe, expect, it } from "vitest";

import {
  currentMonthRange,
  formatMonthLabel,
  monthRange,
  monthRangeFromKey,
  nextMonthRange,
  previousMonthRange,
} from "@/lib/finance/period";

describe("monthRange", () => {
  it("returns inclusive [start, end] and exclusive nextStart for a 30-day month", () => {
    const r = monthRange(2026, 3); // April 2026
    expect(r.key).toBe("2026-04");
    expect(r.start.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-04-30T00:00:00.000Z");
    expect(r.nextStart.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("handles 31-day months", () => {
    const r = monthRange(2026, 0); // January 2026
    expect(r.end.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("handles February in a leap year", () => {
    const r = monthRange(2024, 1);
    expect(r.end.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("handles February in a non-leap year", () => {
    const r = monthRange(2026, 1);
    expect(r.end.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("monthRangeFromKey", () => {
  it("parses YYYY-MM", () => {
    expect(monthRangeFromKey("2026-05").key).toBe("2026-05");
  });

  it("rejects bad inputs", () => {
    expect(() => monthRangeFromKey("not-a-month")).toThrow();
    expect(() => monthRangeFromKey("2026-13")).toThrow();
    expect(() => monthRangeFromKey("2026-00")).toThrow();
  });
});

describe("previous / next / current", () => {
  it("walks forwards and backwards through year boundaries", () => {
    const dec = monthRange(2026, 11);
    expect(nextMonthRange(dec).key).toBe("2027-01");
    expect(previousMonthRange(dec).key).toBe("2026-11");

    const jan = monthRange(2026, 0);
    expect(previousMonthRange(jan).key).toBe("2025-12");
  });

  it("currentMonthRange uses UTC now", () => {
    const fixed = new Date("2026-05-18T16:00:00.000Z");
    const r = currentMonthRange(fixed);
    expect(r.key).toBe("2026-05");
  });
});

describe("formatMonthLabel", () => {
  it("renders a human-friendly month + year string in UTC", () => {
    expect(formatMonthLabel(monthRange(2026, 4))).toBe("May 2026");
  });
});
