import { createServer } from "node:http";
import functions from "@azure/functions";
const { HttpRequest, InvocationContext } = functions;
import { handler } from "./index.js";

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? "/", "http://localhost");
    if (url.pathname === "/health") {
      outgoing.writeHead(200, { "Content-Type": "application/json" });
      outgoing.end('{"status":"ok"}');
      return;
    }
    const match = url.pathname.match(/^\/api\/([^/]+)(?:\/([^/]+))?\/?$/);
    if (!match) {
      outgoing.writeHead(404);
      outgoing.end();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of incoming) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 1024 * 1024) {
        outgoing.writeHead(413);
        outgoing.end();
        return;
      }
      chunks.push(buffer);
    }
    const headers: [string, string][] = [];
    for (const [name, value] of Object.entries(incoming.headers))
      if (typeof value === "string") headers.push([name, value]);
    const request = new HttpRequest({
      method: incoming.method ?? "GET",
      url: url.toString(),
      headers: Object.fromEntries(headers),
      params: {
        resource: decodeURIComponent(match[1]),
        ...(match[2] ? { id: decodeURIComponent(match[2]) } : {}),
      },
      ...(chunks.length ? { body: { bytes: Buffer.concat(chunks) } } : {}),
    });
    const response = await handler(
      request,
      new InvocationContext({ functionName: "finance" }),
    );
    const responseHeaders = new Headers(response.headers);
    if (response.jsonBody !== undefined && !responseHeaders.has("Content-Type"))
      responseHeaders.set("Content-Type", "application/json");
    outgoing.writeHead(
      response.status ?? 200,
      Object.fromEntries(responseHeaders.entries()),
    );
    outgoing.end(
      response.body ??
        (response.jsonBody !== undefined ? JSON.stringify(response.jsonBody) : ""),
    );
  } catch (error) {
    console.error(
      "HTTP adapter failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    outgoing.writeHead(503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    outgoing.end('{"error":"服务暂时不可用"}');
  }
});
server.listen(Number(process.env.PORT ?? "8080"), "0.0.0.0", () =>
  console.log("FinTracker API ready"),
);
process.on("SIGTERM", () => server.close());
