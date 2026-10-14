import {
  InteractionRequiredAuthError,
  PublicClientApplication,
} from "@azure/msal-browser";
import { z } from "zod";
import { accountTypes, monthSchema, dateSchema } from "../shared/finance";

export const publicConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID ?? "",
  scope: process.env.NEXT_PUBLIC_API_SCOPE ?? "",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/FinTracker",
};
export const configured = Boolean(
  publicConfig.apiUrl && publicConfig.clientId && publicConfig.scope,
);
export class ApiError extends Error {
  constructor(
    public status: number,
    text: string,
  ) {
    super(text);
  }
}
export function createAuth() {
  return new PublicClientApplication({
    auth: {
      clientId: publicConfig.clientId,
      authority: "https://login.microsoftonline.com/consumers",
      redirectUri: `${window.location.origin}${publicConfig.basePath}/`,
      postLogoutRedirectUri: `${window.location.origin}${publicConfig.basePath}/`,
    },
    cache: { cacheLocation: "sessionStorage" },
  });
}
export async function request(
  auth: PublicClientApplication,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<Response> {
  const account = auth.getActiveAccount();
  if (!account) throw new Error("请先使用 Microsoft 账户登录");
  let token;
  try {
    token = await auth.acquireTokenSilent({ account, scopes: [publicConfig.scope] });
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await auth.acquireTokenRedirect({ account, scopes: [publicConfig.scope] });
      throw new Error("请完成登录授权");
    }
    throw error;
  }
  const response = await fetch(`${publicConfig.apiUrl.replace(/\/$/, "")}/${path}`, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data: unknown = await response.json();
    const parsed = z.object({ error: z.string() }).safeParse(data);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error : `请求失败 (${response.status})`,
    );
  }
  return response;
}
const ownerId = z.string().nullable(),
  minor = z.string().regex(/^-?\d+$/);
export const storeSchema = z.object({
  people: z.array(z.object({ id: z.string(), name: z.string() })),
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(accountTypes),
      ownerId,
      assetEnabled: z.boolean(),
      expenseEnabled: z.boolean(),
      archived: z.boolean(),
      version: z.number(),
    }),
  ),
  lines: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(["INCOME", "EXPENSE"]),
      ownerId,
      accountId: z.string().nullable(),
      archived: z.boolean(),
    }),
  ),
  periods: z.array(
    z.object({
      month: monthSchema,
      incomeComplete: z.boolean(),
      expenseComplete: z.boolean(),
      version: z.number(),
    }),
  ),
  entries: z.array(
    z.object({
      id: z.string(),
      lineId: z.string(),
      month: monthSchema,
      ownerId,
      amountMinor: minor,
      note: z.string(),
    }),
  ),
  balances: z.array(
    z.object({
      id: z.string(),
      accountId: z.string(),
      asOf: dateSchema,
      precision: z.enum(["DAY", "MONTH"]),
      ownerId,
      amountMinor: minor,
      note: z.string(),
      version: z.number(),
    }),
  ),
  references: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      kind: z.string(),
      period: z.string(),
      ownerId,
      valueMinor: minor.nullable(),
      note: z.string(),
    }),
  ),
});
