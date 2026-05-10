/*
 * Audit log scaffold.
 *
 * Phase 2: emits structured JSON to stdout. Application Insights ingests
 * stdout in Azure Container Apps so this is enough for an audit trail in
 * production. Phase 3 will move persistence to the `audit_events` table.
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
}
