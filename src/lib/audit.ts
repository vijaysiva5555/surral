import { AuditLog } from "@/models/AuditLog";
import type { Session } from "next-auth";

/** one changed value: `field` is a readable label ("Line 2 · Qty"), `from` / `to` are already formatted for display */
export type AuditChange = { field: string; from?: string; to?: string };

/** Writes one audit entry. `summary` is the one-line headline; `changes` lists what was modified (before → after). Never throws. */
export async function audit(session: Session, action: string, entity: string, entityId: string, summary: string, changes?: AuditChange[]) {
  try {
    await AuditLog.create({ userId: session.user.id, userName: session.user.name, role: session.user.role, action, entity, entityId, summary, changes: changes?.length ? changes : undefined });
  } catch (e) { console.error("audit failed", e); }
}
