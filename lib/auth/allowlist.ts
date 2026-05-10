/*
 * Household allowlist.
 *
 * Phase 2: a tiny env-driven allowlist gates sign-in. This is intentional —
 * the real `households` / `household_memberships` tables arrive in Phase 3 and
 * this file becomes a thin wrapper around a DB lookup at that point.
 *
 * Configure via env (lowercased, comma separated):
 *   AUTH_HOUSEHOLD_OWNER_EMAILS=junjie@example.com
 *   AUTH_HOUSEHOLD_MEMBER_EMAILS=jinyou@example.com
 */

export type HouseholdRole = "owner" | "member";

function parseEmails(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

const owners = parseEmails(process.env.AUTH_HOUSEHOLD_OWNER_EMAILS);
const members = parseEmails(process.env.AUTH_HOUSEHOLD_MEMBER_EMAILS);

export function isHouseholdMember(email: string): boolean {
  const e = email.toLowerCase();
  return owners.has(e) || members.has(e);
}

export function householdRoleFor(email: string): HouseholdRole {
  return owners.has(email.toLowerCase()) ? "owner" : "member";
}

export function householdEmails(): { owners: string[]; members: string[] } {
  return {
    owners: Array.from(owners),
    members: Array.from(members),
  };
}
