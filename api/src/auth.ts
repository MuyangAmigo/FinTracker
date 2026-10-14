import {
  createRemoteJWKSet,
  jwtVerify,
  errors,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";
export const identitySchema = z
  .array(
    z.object({
      tenantId: z
        .string()
        .uuid()
        .transform((v) => v.toLowerCase()),
      objectId: z
        .string()
        .uuid()
        .transform((v) => v.toLowerCase()),
      personId: z.string().min(1),
    }),
  )
  .min(1)
  .max(2)
  .refine(
    (ids) => new Set(ids.map((i) => `${i.tenantId}:${i.objectId}`)).size === ids.length,
    "Distinct identities are required",
  );
export type Identity = z.infer<typeof identitySchema>[number];
const keys = createRemoteJWKSet(
  new URL("https://login.microsoftonline.com/consumers/discovery/v2.0/keys"),
);
export function identify(
  claims: JWTPayload,
  identities: Identity[],
  scope: string,
): Identity {
  if (
    claims.ver !== "2.0" ||
    typeof claims.scp !== "string" ||
    !claims.scp.split(/\s+/).includes(scope)
  )
    throw new HttpError(403, "缺少 API 授权");
  const match = identities.find(
    (i) => i.tenantId === claims.tid && i.objectId === claims.oid,
  );
  if (!match) throw new HttpError(403, "此 Microsoft 账户未获家庭访问权限");
  return match;
}
export async function validateAccessClaims(
  token: string,
  tenants: string[],
  audience: string,
  scope: string,
  resolver: JWTVerifyGetKey = keys,
): Promise<JWTPayload> {
  let claims: JWTPayload;
  try {
    ({ payload: claims } = await jwtVerify(token, resolver, {
      audience: [audience, `api://${audience}`],
      issuer: [
        ...new Set(
          tenants.map((tenant) => `https://login.microsoftonline.com/${tenant}/v2.0`),
        ),
      ],
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "tid", "scp", "sub"],
    }));
  } catch (error) {
    if (
      error instanceof errors.JOSEError &&
      /^(ERR_JWT|ERR_JWS|ERR_JOSE_ALG_NOT_ALLOWED|ERR_JWKS_NO_MATCHING_KEY)/.test(
        error.code,
      )
    )
      throw new HttpError(401, "登录已失效或令牌无效，请重新登录");
    throw new HttpError(503, "暂时无法验证 Microsoft 登录，请稍后重试");
  }
  if (
    typeof claims.tid !== "string" ||
    typeof claims.sub !== "string" ||
    typeof claims.scp !== "string" ||
    !claims.scp.split(/\s+/).includes(scope)
  )
    throw new HttpError(403, "缺少 API 授权");
  return claims;
}
export async function verifyAccessToken(
  token: string,
  identities: Identity[],
  audience: string,
  scope: string,
  resolver: JWTVerifyGetKey = keys,
): Promise<Identity> {
  return identify(
    await validateAccessClaims(
      token,
      identities.map((i) => i.tenantId),
      audience,
      scope,
      resolver,
    ),
    identities,
    scope,
  );
}
export function authorizeSubject(
  claims: JWTPayload,
  subject: string,
  personId: string,
): Identity {
  if (claims.tid !== CONSUMER_TENANT || !subject || claims.sub !== subject)
    throw new HttpError(403, "此 Microsoft 账户未获家庭访问权限");
  return { tenantId: CONSUMER_TENANT, objectId: subject, personId };
}
export async function authenticate(header: string | null): Promise<Identity> {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new HttpError(401, "请先登录");
  const audience = process.env.API_AUDIENCE,
    scope = process.env.API_SCOPE ?? "FinTracker.Access";
  if (!audience) throw new HttpError(503, "后端登录配置尚未完成");
  const subject = process.env.ALLOWED_MICROSOFT_SUB;
  if (subject) {
    const personId = process.env.AUTH_PERSON_ID;
    if (!personId) throw new HttpError(503, "家庭成员配置未完成");
    const claims = await validateAccessClaims(
      match[1],
      [CONSUMER_TENANT],
      audience,
      scope,
    );
    return authorizeSubject(claims, subject, personId);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(process.env.ALLOWED_IDENTITIES ?? "[]");
  } catch {
    throw new HttpError(503, "后端身份配置无效");
  }
  const validated = identitySchema.safeParse(parsed);
  if (!validated.success) throw new HttpError(503, "后端身份配置无效");
  return verifyAccessToken(match[1], validated.data, audience, scope);
}
