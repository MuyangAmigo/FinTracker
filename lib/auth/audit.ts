/*
 * Audit log scaffold.
 *
 * Emits structured JSON to stdout (so Application Insights / Container Apps
 * pick it up unconditionally) AND attempts a best-effort write to the
 * `audit_events` table. The DB write is fire-and-forget — if Prisma is
 * unreachable or throws, the auth/finance flow never breaks because of audit.
 *
 * Categories per plan.md security design:
 *   - login        — successful sign-in
 *   - login_denied — rejected by allowlist or provider
 *   - signout      — explicit sign-out
 *   - import       — CSV import staged/committed
 *   - export       — data exported
 *   - finance.write — transaction/account/budget mutation
 *   - admin.*      — household membership / settings change
 *   - insight      — AI insight generated
 */

import { prisma } from "@/lib/db";

export type AuditEventType =
  | "login"
  | "login_denied"
  | "signout"
  | "import"
  | "export"
  | "finance.write"
  | "admin.member"
  | "admin.settings"
  | "insight";

export interface AuditEvent {
  type: AuditEventType;
  actor: string | null;
  householdId?: string | null;
  resource?: string;
  metadata?: Record<string, unknown>;
}

export function audit(event: AuditEvent): void {
  const entry = {
    audit: true,
    ts: new Date().toISOString(),
    ...event,
  };
  console.log(JSON.stringify(entry));

  // Best-effort DB persist. Promise rejections are swallowed so a database
  // outage cannot break sign-in or any mutation.
  void persistAudit(event).catch((err) => {
    console.warn(
      JSON.stringify({
        audit: true,
        warn: "audit_persist_failed",
        type: event.type,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });
}

async function persistAudit(event: AuditEvent): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: event.type,
      actorEmail: event.actor,
      householdId: event.householdId ?? null,
      resource: event.resource,
      metadata: (event.metadata ?? null) as never,
    },
  });
}
