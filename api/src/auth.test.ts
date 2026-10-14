import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { verifyAccessToken, authenticate } from "./auth.js";

describe("API JWT validation", () => {
  it("validates signature, audience, issuer, expiry, scope, and both allowed identities", async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    const jwk = await exportJWK(pair.publicKey);
    const resolver = createLocalJWKSet({
      keys: [{ ...jwk, kid: "synthetic", alg: "RS256" }],
    });
    const identities = [
      { tenantId: "tenant-a", objectId: "user-a", personId: "a" },
      { tenantId: "tenant-b", objectId: "user-b", personId: "b" },
    ];
    async function token(
      options: {
        audience?: string;
        issuer?: string;
        expiry?: string;
        scope?: string;
        user?: number;
      } = {},
    ) {
      const user = identities[options.user ?? 0];
      return new SignJWT({
        tid: user.tenantId,
        oid: user.objectId,
        ver: "2.0",
        scp: options.scope ?? "access_as_user",
      })
        .setProtectedHeader({ alg: "RS256", kid: "synthetic" })
        .setIssuedAt()
        .setIssuer(
          options.issuer ?? `https://login.microsoftonline.com/${user.tenantId}/v2.0`,
        )
        .setAudience(options.audience ?? "fintracker-api")
        .setExpirationTime(options.expiry ?? "5m")
        .sign(pair.privateKey);
    }
    const verify = async (options = {}) =>
      verifyAccessToken(
        await token(options),
        identities,
        "fintracker-api",
        "access_as_user",
        resolver,
      );
    expect((await verify()).personId).toBe("a");
    expect((await verify({ user: 1 })).personId).toBe("b");
    await expect(verify({ audience: "microsoft-graph" })).rejects.toMatchObject({
      status: 401,
    });
    await expect(verify({ issuer: "https://untrusted.invalid" })).rejects.toMatchObject({
      status: 401,
    });
    await expect(verify({ expiry: "-1m" })).rejects.toMatchObject({ status: 401 });
    await expect(verify({ scope: "User.Read" })).rejects.toMatchObject({ status: 403 });
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "synthetic" })
      .sign(other.privateKey);
    await expect(
      verifyAccessToken(forged, identities, "fintracker-api", "access_as_user", resolver),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("denies missing bearer tokens before accessing the database", async () => {
    await expect(authenticate(null)).rejects.toMatchObject({ status: 401 });
    await expect(authenticate("Basic synthetic")).rejects.toMatchObject({ status: 401 });
  });
});
