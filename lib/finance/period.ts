/*
 * Period / month helpers used by Phase-5 surfaces.
 *
 * All values are UTC dates anchored to midnight to match Postgres `@db.Date`
 * storage in the Prisma schema. We deliberately do NOT use the local
 * timezone — finance periods are calendar months, not "the user's clock".
 */

export interface MonthRange {
  /** YYYY-MM string for display / URL params. */
  key: string;
  /** First day of the month, midnight UTC. */
  start: Date;
  /** Last day of the month, midnight UTC. */
  end: Date;
  /** First day of the next month, midnight UTC. Useful for `lt` Prisma filters. */
  nextStart: Date;
}

export function monthRange(year: number, monthZeroBased: number): MonthRange {
  const start = new Date(Date.UTC(year, monthZeroBased, 1));
  const nextStart = new Date(Date.UTC(year, monthZeroBased + 1, 1));
  const end = new Date(nextStart.getTime() - 24 * 60 * 60 * 1000);
  // Read year/month off `start` so we normalise overflowing inputs (e.g.
  // monthZeroBased = 12 wraps into January of year+1).
  const normalisedYear = start.getUTCFullYear();
  const normalisedMonth = start.getUTCMonth() + 1;
  const key = `${normalisedYear.toString().padStart(4, "0")}-${normalisedMonth
    .toString()
    .padStart(2, "0")}`;
  return { key, start, end, nextStart };
}

export function monthRangeFromKey(key: string): MonthRange {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`invalid month key "${key}", expected YYYY-MM`);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) {
    throw new Error(`invalid month "${key}"`);
  }
  return monthRange(year, month);
}

export function currentMonthRange(now: Date = new Date()): MonthRange {
  return monthRange(now.getUTCFullYear(), now.getUTCMonth());
}

export function previousMonthRange(range: MonthRange): MonthRange {
  return monthRange(range.start.getUTCFullYear(), range.start.getUTCMonth() - 1);
}

export function nextMonthRange(range: MonthRange): MonthRange {
  return monthRange(range.start.getUTCFullYear(), range.start.getUTCMonth() + 1);
}

export function formatMonthLabel(
  range: MonthRange,
  locale: string = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(range.start);
}
