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
  .length(2)
  .refine(
    (ids) => new Set(ids.map((i) => `${i.tenantId}:${i.objectId}`)).size === 2,
    "Two distinct identities are required",
  );
export type Identity = z.infer<typeof identitySchema>[number];
export function identify(
  claims: JWTPayload,
  identities: Identity[],
  scope: string,
): Identity {
  if (
    claims.ver !== "2.0" ||
    typeof claims.scp !== "string" ||
    !claims.scp.split(" ").includes(scope)
  )
    throw new HttpError(403, "缺少 API 授权");
  const match = identities.find(
    (i) => i.tenantId === claims.tid && i.objectId === claims.oid,
  );
  if (!match) throw new HttpError(403, "此 Microsoft 账户未获家庭访问权限");
  return match;
}
const keys = createRemoteJWKSet(
  new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"),
);
export async function verifyAccessToken(
  token: string,
  identities: Identity[],
  audience: string,
  scope: string,
  resolver: JWTVerifyGetKey = keys,
): Promise<Identity> {
  const issuers = [
    ...new Set(
      identities.map((i) => `https://login.microsoftonline.com/${i.tenantId}/v2.0`),
    ),
  ];
  let claims: JWTPayload;
  try {
    ({ payload: claims } = await jwtVerify(token, resolver, {
      audience,
      issuer: issuers,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "tid", "oid", "ver", "scp"],
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
  return identify(claims, identities, scope);
}
export async function authenticate(header: string | null): Promise<Identity> {
  if (!header?.startsWith("Bearer ")) throw new HttpError(401, "请先登录");
  const audience = process.env.API_AUDIENCE;
  const raw = process.env.ALLOWED_IDENTITIES;
  if (!audience || !raw) throw new HttpError(503, "后端登录配置尚未完成");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(503, "后端身份配置无效");
  }
  const validated = identitySchema.safeParse(parsed);
  if (!validated.success) throw new HttpError(503, "后端身份配置无效");
  const identities = validated.data;
  return verifyAccessToken(
    header.slice(7),
    identities,
    audience,
    process.env.API_SCOPE ?? "access_as_user",
  );
}
