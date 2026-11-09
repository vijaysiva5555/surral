import type { Session } from "next-auth";

export type ApprovalStatus = "none" | "pending" | "approved" | "rejected";

export const EXPORT_BLOCKED = "Admin approval is required before you can download, e-mail or share this quotation.";

/** Customer-facing exports (PDF, Excel, share link, e-mail) */
export function canExportQuote(session: Session, q: { approvalStatus?: string }) {
  if (session.user.role === "admin") return true;
  return (q.approvalStatus ?? "none") === "approved";
}

export function isQuoteApproved(q: { approvalStatus?: string }) {
  return (q.approvalStatus ?? "none") === "approved";
}

export function initialApprovalForRole(role: string): ApprovalStatus {
  return role === "admin" ? "approved" : "none";
}

const LOCKED_MSG = "This quotation is approved and locked. Use Revise to create a new revision if you need to change it.";

export function isQuoteLockedForSales(session: Session, q: { approvalStatus?: string; createdBy?: string }) {
  if (session.user.role !== "sales") return false;
  if (String(q.createdBy) !== session.user.id) return false;
  return isQuoteApproved(q);
}

export { LOCKED_MSG as QUOTE_LOCKED_FOR_SALES };
