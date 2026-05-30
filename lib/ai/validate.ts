import { z } from "zod";

/*
 * Structured contract for what the model is required to return.
 *
 * We ask for STRICT JSON via the chat-completions
 * `response_format: { type: "json_object" }` setting; the response is then
 * parsed and re-validated here. If validation fails the orchestrator
 * marks the run FAILED rather than persisting a malformed insight.
 */

export const insightResponseSchema = z.object({
  title: z.string().min(4).max(140),
  summary: z.string().min(20).max(2000),
  keyMetrics: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        value: z.string().min(1).max(80),
      }),
    )
    .max(8)
    .default([]),
  recommendations: z.array(z.string().min(4).max(280)).max(6).default([]),
  flags: z
    .array(
      z.object({
        kind: z.enum(["positive", "warning", "watch"]),
        message: z.string().min(4).max(280),
      }),
    )
    .max(6)
    .default([]),
});

export type InsightResponse = z.infer<typeof insightResponseSchema>;

export const anomalyResponseSchema = z.object({
  title: z.string().min(4).max(140),
  summary: z.string().min(10).max(2000),
  anomalies: z
    .array(
      z.object({
        ref: z.string().min(1).max(40),
        severity: z.enum(["low", "medium", "high"]),
        explanation: z.string().min(4).max(600),
      }),
    )
    .max(20)
    .default([]),
  recommendations: z.array(z.string().min(4).max(280)).max(6).default([]),
  flags: z
    .array(
      z.object({
        kind: z.enum(["positive", "warning", "watch"]),
        message: z.string().min(4).max(280),
      }),
    )
    .max(6)
    .default([]),
});

export type AnomalyResponse = z.infer<typeof anomalyResponseSchema>;
