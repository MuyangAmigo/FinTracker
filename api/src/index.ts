import functions, {
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from "@azure/functions";
const { app } = functions;
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { authenticate, HttpError } from "./auth.js";
import { execute } from "./service.js";

export async function handler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get("origin");
  const allowed = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
  if (origin && !allowed.includes(origin))
    return { status: 403, headers, jsonBody: { error: "请求来源未获允许" } };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Authorization,Content-Type";
  if (request.method === "OPTIONS") return { status: 204, headers };
  try {
    const body: unknown = request.method === "GET" ? null : await request.json();
    const identity = await authenticate(request.headers.get("authorization"));
    const result = await execute(
      request.params.resource,
      request.params.id,
      request.method,
      body,
      identity,
    );
    if (typeof result === "string")
      return {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="fintracker-${request.params.id}.csv"`,
        },
        body: result,
      };
    return {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(result, (_, v: unknown) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    };
  } catch (error) {
    if (error instanceof HttpError)
      return { status: error.status, headers, jsonBody: { error: error.message } };
    if (error instanceof ZodError)
      return {
        status: 400,
        headers,
        jsonBody: { error: error.issues.map((i) => i.message).join("；") },
      };
    if (error instanceof SyntaxError)
      return { status: 400, headers, jsonBody: { error: "JSON 格式无效" } };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return { status: 409, headers, jsonBody: { error: "记录已存在，请刷新后重试" } };
    context.error(
      "Finance request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return { status: 503, headers, jsonBody: { error: "服务暂时不可用，请稍后重试" } };
  }
}
app.http("finance", {
  route: "{resource}/{id?}",
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  handler,
});
