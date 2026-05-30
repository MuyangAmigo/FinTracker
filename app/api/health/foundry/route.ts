import { NextResponse } from "next/server";

import { readFoundryConfig } from "@/lib/ai/foundry";
import { PROMPT_VERSION } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Diagnostic for the Foundry / Azure OpenAI integration. Reports whether
 * env wiring is present and which deployment / prompt version the app
 * will use. We deliberately do NOT make a live request here — keeping the
 * probe cheap means it can be polled from uptime monitors without burning
 * model quota or leaking latency variance from the upstream API.
 */
export async function GET() {
  const cfg = readFoundryConfig();
  if (!cfg) {
    return NextResponse.json({
      status: "ok",
      mode: "mock",
      configured: false,
      promptVersion: PROMPT_VERSION,
    });
  }
  return NextResponse.json({
    status: "ok",
    mode: "live",
    configured: true,
    deployment: cfg.deployment,
    apiVersion: cfg.apiVersion,
    promptVersion: PROMPT_VERSION,
    endpoint: cfg.endpoint.replace(/\/+$/, ""),
  });
}
