import { AuditLog } from "@/models/AuditLog";
import type { Session } from "next-auth";

export async function audit(session: Session, action: string, entity: string, entityId: string, summary: string) {
  try { await AuditLog.create({ userId: session.user.id, userName: session.user.name, action, entity, entityId, summary }); } catch (e) { console.error("audit failed", e); }
}
