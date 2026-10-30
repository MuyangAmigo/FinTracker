import { gunzipSync } from "node:zlib";
import functions from "@azure/functions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./auth.js";
import { handler } from "./index.js";

const { HttpRequest, InvocationContext } = functions;
const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), execute: vi.fn() }));
vi.mock("./auth.js", async () => ({
  ...(await vi.importActual<typeof import("./auth.js")>("./auth.js")),
  authenticate: mocks.authenticate,
}));
vi.mock("./service.js", () => ({ execute: mocks.execute }));

const data = {
  entries: Array.from({ length: 200 }, (_, i) => ({
    id: `synthetic-${i}`,
    month: "2024-01",
    amountMinor: 12345n,
    note: "Synthetic household record",
  })),
};
function get(encoding?: string, origin?: string) {
  return handler(
    new HttpRequest({
      method: "GET",
      url: "https://example.test/api/bootstrap",
      params: { resource: "bootstrap" },
      headers: {
        ...(encoding ? { "Accept-Encoding": encoding } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
    }),
    new InvocationContext({ functionName: "finance" }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticate.mockResolvedValue({
    tenantId: "synthetic-tenant",
    objectId: "synthetic-user",
    personId: "synthetic-person",
  });
  mocks.execute.mockResolvedValue(data);
});

describe("private API response compression", () => {
  it.each(["gzip", "br, gzip, deflate", "GZip; q=0.5"])(
    "compresses large authorized JSON for %s without losing exact money values",
    async (encoding) => {
      const response = await get(encoding);
      const headers = new Headers(response.headers);
      expect(response.status).toBe(200);
      expect(headers.get("Content-Encoding")).toBe("gzip");
      expect(headers.get("Cache-Control")).toBe("no-store");
      expect(headers.get("Vary")).toBe("Origin, Accept-Encoding");
      expect(response.body).toBeInstanceOf(Uint8Array);
      if (!(response.body instanceof Uint8Array)) throw new Error("Expected gzip bytes");
      const decoded = gunzipSync(response.body).toString();
      expect(JSON.parse(decoded).entries[0].amountMinor).toBe("12345");
      expect(JSON.parse(decoded).entries).toHaveLength(200);
      expect(response.body.byteLength).toBeLessThan(Buffer.byteLength(decoded) / 5);
    },
  );
  it.each([undefined, "br", "gzip;q=0", "gzip; q=0.000, br"])(
    "returns ordinary JSON when gzip is not accepted: %s",
    async (encoding) => {
      const response = await get(encoding);
      expect(new Headers(response.headers).has("Content-Encoding")).toBe(false);
      expect(typeof response.body).toBe("string");
    },
  );
  it("does not compress small replies", async () => {
    mocks.execute.mockResolvedValue({ saved: true });
    const response = await get("gzip");
    expect(new Headers(response.headers).has("Content-Encoding")).toBe(false);
    expect(response.body).toBe('{"saved":true}');
  });
  it("still rejects unauthenticated requests before reading finance data", async () => {
    mocks.authenticate.mockRejectedValue(new HttpError(401, "请先登录"));
    const response = await get("gzip");
    expect(response.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(response.jsonBody).toEqual({ error: "请先登录" });
    expect(new Headers(response.headers).get("Cache-Control")).toBe("no-store");
  });
  it("still rejects an unapproved origin", async () => {
    const response = await get("gzip", "https://unapproved.invalid");
    expect(response.status).toBe(403);
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
