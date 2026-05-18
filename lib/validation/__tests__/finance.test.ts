import { describe, expect, it } from "vitest";

import {
  createAccountSnapshotSchema,
  createBudgetSchema,
  createTransactionSchema,
  updateTransactionSchema,
} from "@/lib/validation/finance";

const CUID = "ckpqxabcd1234567890abcde"; // 25-char cuid-shaped string
const CUID2 = "ckpqxfghij1234567890abcde";

describe("createTransactionSchema", () => {
  it("accepts a basic expense", () => {
    const parsed = createTransactionSchema.parse({
      kind: "EXPENSE",
      occurredOn: "2026-05-18",
      money: { amountMajor: "42.50", currency: "CNY" },
      accountId: CUID,
      categoryId: CUID2,
      personTag: "Junjie",
    });

    expect(parsed.kind).toBe("EXPENSE");
    expect(parsed.money).toEqual({ amountMinor: 4250, currency: "CNY" });
    expect(parsed.scope).toBe("HOUSEHOLD");
    expect(parsed.occurredOn.toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });

  it("requires both sides on a transfer", () => {
    const result = createTransactionSchema.safeParse({
      kind: "TRANSFER",
      occurredOn: "2026-05-18",
      money: { amountMajor: "100", currency: "CNY" },
      fromAccountId: CUID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("both fromAccountId and toAccountId"),
        ),
      ).toBe(true);
    }
  });

  it("rejects a transfer where both sides match", () => {
    const result = createTransactionSchema.safeParse({
      kind: "TRANSFER",
      occurredOn: "2026-05-18",
      money: { amountMajor: "100", currency: "CNY" },
      fromAccountId: CUID,
      toAccountId: CUID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("source and destination must differ"),
        ),
      ).toBe(true);
    }
  });

  it("requires accountId for non-transfers", () => {
    const result = createTransactionSchema.safeParse({
      kind: "INCOME",
      occurredOn: "2026-05-18",
      money: { amountMajor: "1000", currency: "CNY" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("Non-transfer transactions require an accountId"),
        ),
      ).toBe(true);
    }
  });

  it("rejects non-ISO currency strings", () => {
    const result = createTransactionSchema.safeParse({
      kind: "INCOME",
      occurredOn: "2026-05-18",
      money: { amountMajor: "1000", currency: "yuan" },
      accountId: CUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed dates", () => {
    const result = createTransactionSchema.safeParse({
      kind: "INCOME",
      occurredOn: "May 18 2026",
      money: { amountMajor: "1000", currency: "CNY" },
      accountId: CUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed money inputs", () => {
    const result = createTransactionSchema.safeParse({
      kind: "INCOME",
      occurredOn: "2026-05-18",
      money: { amountMajor: "twelve", currency: "CNY" },
      accountId: CUID,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTransactionSchema", () => {
  it("accepts a partial update", () => {
    const parsed = updateTransactionSchema.parse({
      id: CUID,
      note: "groceries at 7-11",
    });
    expect(parsed.note).toBe("groceries at 7-11");
  });

  it("still enforces transfer two-sidedness when kind=TRANSFER is supplied", () => {
    const result = updateTransactionSchema.safeParse({
      id: CUID,
      kind: "TRANSFER",
      fromAccountId: CUID2,
      // toAccountId missing
    });
    expect(result.success).toBe(false);
  });
});

describe("createAccountSnapshotSchema", () => {
  it("accepts a balance entry", () => {
    const parsed = createAccountSnapshotSchema.parse({
      accountId: CUID,
      asOf: "2026-05-31",
      money: { amountMajor: "12345.67", currency: "CNY" },
    });
    expect(parsed.money.amountMinor).toBe(1234567);
  });
});

describe("createBudgetSchema", () => {
  it("accepts a monthly category budget", () => {
    const parsed = createBudgetSchema.parse({
      categoryId: CUID,
      period: "MONTHLY",
      periodStart: "2026-05-01",
      money: { amountMajor: "5000", currency: "CNY" },
      personTag: "Junjie",
    });
    expect(parsed.period).toBe("MONTHLY");
    expect(parsed.money.amountMinor).toBe(500000);
  });
});
