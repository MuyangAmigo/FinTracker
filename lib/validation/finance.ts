import { z } from "zod";

import { fromMajor } from "@/lib/money";

/*
 * Shared validation schemas for finance writes.
 *
 * All money inputs come in as MAJOR-unit decimals (what humans type) and are
 * coerced into Money objects with integer minor units. Currency is required
 * everywhere — there's no implicit default at the form layer; defaults are
 * applied by callers based on the household's base currency.
 */

export const ISO_CURRENCY_REGEX = /^[A-Z]{3}$/;

const moneyMajorString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v), {
    message: "Amount must be a decimal number, e.g. 12.34",
  });

export const moneyInputSchema = z
  .object({
    amountMajor: moneyMajorString,
    currency: z.string().regex(ISO_CURRENCY_REGEX, "ISO 4217 code, e.g. CNY"),
  })
  .transform(({ amountMajor, currency }) =>
    fromMajor(parseFloat(amountMajor), currency),
  );

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

export const transactionKindSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "INVESTMENT_CONTRIBUTION",
  "INVESTMENT_WITHDRAWAL",
  "ADJUSTMENT",
]);

export const transactionScopeSchema = z.enum(["HOUSEHOLD", "PERSONAL"]);

export const createTransactionSchema = z
  .object({
    kind: transactionKindSchema,
    scope: transactionScopeSchema.default("HOUSEHOLD"),
    occurredOn: isoDate,
    money: moneyInputSchema,
    categoryId: z.string().cuid().optional(),
    accountId: z.string().cuid().optional(),
    fromAccountId: z.string().cuid().optional(),
    toAccountId: z.string().cuid().optional(),
    payee: z.string().max(200).optional(),
    note: z.string().max(2000).optional(),
    personTag: z.string().max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "TRANSFER") {
      if (!value.fromAccountId || !value.toAccountId) {
        ctx.addIssue({
          code: "custom",
          message: "Transfers require both fromAccountId and toAccountId",
        });
      }
      if (value.fromAccountId && value.fromAccountId === value.toAccountId) {
        ctx.addIssue({
          code: "custom",
          message: "Transfer source and destination must differ",
        });
      }
    } else if (!value.accountId) {
      ctx.addIssue({
        code: "custom",
        message: "Non-transfer transactions require an accountId",
      });
    }
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Update variant — same shape but every field is optional except `id`. We
 * apply the same TRANSFER / non-TRANSFER invariant. Callers should merge
 * the parsed result onto the existing row before persisting.
 */
export const updateTransactionSchema = z
  .object({
    id: z.string().cuid(),
    kind: transactionKindSchema.optional(),
    scope: transactionScopeSchema.optional(),
    occurredOn: isoDate.optional(),
    money: moneyInputSchema.optional(),
    categoryId: z.string().cuid().nullable().optional(),
    accountId: z.string().cuid().nullable().optional(),
    fromAccountId: z.string().cuid().nullable().optional(),
    toAccountId: z.string().cuid().nullable().optional(),
    payee: z.string().max(200).nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
    personTag: z.string().max(64).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "TRANSFER") {
      if (!value.fromAccountId || !value.toAccountId) {
        ctx.addIssue({
          code: "custom",
          message: "Transfers require both fromAccountId and toAccountId",
        });
      }
      if (
        value.fromAccountId &&
        value.fromAccountId === value.toAccountId
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Transfer source and destination must differ",
        });
      }
    }
  });

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const accountKindSchema = z.enum([
  "CASH",
  "BANK",
  "WALLET",
  "CREDIT_CARD",
  "BROKERAGE",
  "ESPP",
  "INSURANCE",
  "INVESTMENT",
  "LIABILITY",
  "OTHER",
]);

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: accountKindSchema,
  ownerUserId: z.string().cuid().optional(),
  externalRef: z.string().max(64).optional(),
  currency: z.string().regex(ISO_CURRENCY_REGEX).default("CNY"),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const createAccountSnapshotSchema = z.object({
  accountId: z.string().cuid(),
  asOf: isoDate,
  money: moneyInputSchema,
  note: z.string().max(2000).optional(),
});

export type CreateAccountSnapshotInput = z.infer<
  typeof createAccountSnapshotSchema
>;

export const createBudgetSchema = z.object({
  categoryId: z.string().cuid().optional(),
  period: z.enum(["MONTHLY", "ANNUAL"]),
  periodStart: isoDate,
  money: moneyInputSchema,
  personTag: z.string().max(64).optional(),
  note: z.string().max(2000).optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
