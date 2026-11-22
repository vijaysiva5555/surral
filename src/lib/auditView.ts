/* eslint-disable @typescript-eslint/no-explicit-any */
/* Shared by the audit page, its API and the Excel export: names for record types and actions, the link to a record,
   and the list filters. Pure, so the client page can import it too. */

export const ENTITY_LABEL: Record<string, string> = {
  quote: "Quotation", projectQuote: "Project offer", bom: "BOM", customer: "Customer", agreement: "Price agreement", part: "Part", priceList: "Price list",
  hsn: "HSN code", terms: "Terms template", company: "Company", user: "User", profile: "Profile", upload: "File upload",
  stockOutward: "Stock outward", stockInward: "Stock inward", stockItem: "Stock item", stockImport: "Stock import", pageAccess: "Page access",
};
export const ACTION_LABEL: Record<string, string> = {
  create: "Created", update: "Edited", delete: "Deleted", status: "Status", duplicate: "Duplicated", revise: "Revised", share: "Shared", unshare: "Unshared",
  import: "Imported", reimport: "Re-imported", upload: "Uploaded", password: "Password", login: "Signed in", "login-failed": "Sign-in failed",
};
const words = (s: string) => { const w = String(s ?? "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase(); return w.charAt(0).toUpperCase() + w.slice(1); };
export const entityLabel = (e: string) => ENTITY_LABEL[e] ?? words(e);
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? words(a);

const UPLOAD_KEY = /^[\w-]+\/(offers|logos|quotes)\/\d{4}\/[0-9a-f-]{36}\.(jpg|png)$/;
/** Where the record of an audit entry can be opened, or null (deleted records, imports, sign-ins…). /quotations/<id> and
    /bom/<id> redirect to the Spare or Equipment section the record belongs to. */
export function recordHref(a: { entity: string; entityId?: string; action?: string }): string | null {
  const id = a.entityId && a.entityId !== "-" && a.action !== "delete" ? encodeURIComponent(a.entityId) : "";
  switch (a.entity) {
    case "quote": return id ? `/quotations/${id}` : null;
    case "projectQuote": return id ? `/project/quotations/${id}` : null;
    case "bom": return id ? `/bom/${id}` : null;
    case "stockOutward": return id ? `/stock/outward/${id}` : null;
    case "stockInward": return id ? `/stock/inward/${id}` : null;
    case "stockItem": return "/stock/ledger";
    case "customer": case "agreement": return "/customers";
    case "part": return "/parts";
    case "priceList": return "/pricing";
    case "hsn": return "/hsn";
    case "terms": return "/terms";
    case "company": return "/settings";
    case "profile": return "/profile";
    case "user": return a.action === "login" || a.action === "login-failed" ? null : "/users";
    case "upload": return a.entityId && UPLOAD_KEY.test(a.entityId) ? `/api/files/${a.entityId}` : null;
    default: return null;
  }
}

/** minutes between UTC and the viewer's clock (Date#getTimezoneOffset, so India is -330); India when not given */
export function auditTz(sp: URLSearchParams): number {
  const raw = sp.get("tz"), n = Number(raw);
  return raw !== null && raw !== "" && Number.isFinite(n) && Math.abs(n) <= 840 ? n : -330;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** MongoDB filter for ?user=&entity=&action=&from=yyyy-mm-dd&to=yyyy-mm-dd&q=&tz= — the list and the export take the same ones */
export function auditFilter(sp: URLSearchParams): Record<string, any> {
  const f: Record<string, any> = {};
  const user = sp.get("user")?.trim(), entity = sp.get("entity")?.trim(), action = sp.get("action")?.trim(), q = sp.get("q")?.trim();
  if (user) f.userId = user;
  if (entity) f.entity = entity;
  if (action) f.action = action;
  const tz = auditTz(sp);
  const day = (s: string | null, add: number) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? ""); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + add) + tz * 60000) : null; };
  const from = day(sp.get("from"), 0), to = day(sp.get("to"), 1);   // "to" is inclusive: up to the end of that day
  if (from || to) f.at = { ...(from && { $gte: from }), ...(to && { $lt: to }) };
  if (q) { const re = new RegExp(esc(q), "i"); f.$or = [{ summary: re }, { "changes.field": re }, { "changes.from": re }, { "changes.to": re }]; }
  return f;
}
