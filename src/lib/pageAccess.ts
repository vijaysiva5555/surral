/* Which roles may open which page – the admin sets this on the Page access screen (Administration → Page access).
   Pure data and helpers, used by the request proxy (every page load), the sidebar and the settings screen.

   Each page lists the roles that CAN use it at all (`allowed`): the page's data and buttons are built for those roles,
   so a role outside that list cannot be switched on (BOM packages hold cost data; Users, Company, Audit log and this
   screen stay with admins). Within `allowed` the admin decides. Admins always see every page, and the dashboard and
   My profile are open to everyone, so nobody can be locked out. */
import type { Role } from "./roles";

export const ACCESS_ROLES: Role[] = ["sales", "stock", "viewer"];   // admin is always allowed
const ALL: Role[] = ["admin", "sales", "stock", "viewer"];
const SELL: Role[] = ["admin", "sales"];
const ADMIN: Role[] = ["admin"];

export type PageDef = { key: string; label: string; group: string; paths: string[]; allowed: Role[]; locked?: boolean; note?: string };

export const PAGES: PageDef[] = [
  { key: "dashboard", label: "Dashboard", group: "General", paths: ["/dashboard"], allowed: ALL, locked: true, note: "Always open – everyone lands here" },
  { key: "search", label: "Advanced search", group: "General", paths: ["/search"], allowed: ALL },
  { key: "customers", label: "Customers", group: "General", paths: ["/customers"], allowed: ALL },
  { key: "pricing", label: "Pricing (yearly)", group: "General", paths: ["/pricing"], allowed: ALL },
  { key: "hsn", label: "HSN codes", group: "General", paths: ["/hsn"], allowed: ALL },
  { key: "parts", label: "Parts master", group: "General", paths: ["/parts"], allowed: ALL },
  { key: "equipmentQuotes", label: "Equipment – Quotation", group: "Equipment", paths: ["/equipment/quotations"], allowed: ALL },
  { key: "equipmentBom", label: "Equipment – BOM packages", group: "Equipment", paths: ["/equipment/bom", "/bom"], allowed: SELL, note: "Holds cost data – admin and sales only" },
  { key: "spareQuotes", label: "Spare – Quotation", group: "Spare", paths: ["/spare/quotations", "/quotations"], allowed: ALL },
  { key: "spareBom", label: "Spare – BOM packages", group: "Spare", paths: ["/spare/bom"], allowed: SELL, note: "Holds cost data – admin and sales only" },
  { key: "projectQuotes", label: "Project – Quotation", group: "Project", paths: ["/project/quotations"], allowed: ALL },
  { key: "stockInward", label: "Stock – Inward", group: "Stock", paths: ["/stock/inward"], allowed: ALL },
  { key: "stockOutward", label: "Stock – Outward", group: "Stock", paths: ["/stock/outward"], allowed: ALL },
  { key: "stockLedger", label: "Stock – Ledger", group: "Stock", paths: ["/stock/ledger", "/stock"], allowed: ALL },
  { key: "stockReports", label: "Stock – Reports", group: "Stock", paths: ["/stock/reports"], allowed: ALL },
  { key: "terms", label: "Terms templates", group: "Administration", paths: ["/terms"], allowed: SELL, note: "Editing tool – admin and sales only" },
  { key: "users", label: "Users", group: "Administration", paths: ["/users"], allowed: ADMIN, locked: true, note: "Admins only" },
  { key: "company", label: "Company", group: "Administration", paths: ["/settings"], allowed: ADMIN, locked: true, note: "Admins only" },
  { key: "audit", label: "Audit log", group: "Administration", paths: ["/audit"], allowed: ADMIN, locked: true, note: "Admins only" },
  { key: "access", label: "Page access", group: "Administration", paths: ["/access"], allowed: ADMIN, locked: true, note: "Admins only" },
];

/** page key → the roles (other than admin) that may open it */
export type AccessMap = Record<string, Role[]>;

/** what each role could see before anything was configured: every role its page is built for */
export const defaultAccess = (): AccessMap => Object.fromEntries(PAGES.map((p) => [p.key, p.allowed.filter((r) => r !== "admin")]));

/** a stored map made safe: unknown pages dropped, roles a page is not built for removed, locked pages at their default */
export function resolveAccess(stored: unknown): AccessMap {
  const base = defaultAccess();
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Record<string, unknown>;
  for (const p of PAGES) {
    if (p.locked || !Array.isArray(s[p.key])) continue;
    base[p.key] = (s[p.key] as unknown[]).filter((r): r is Role => typeof r === "string" && p.allowed.includes(r as Role) && r !== "admin");
  }
  return base;
}

/** the page a path belongs to (longest matching path wins, so /stock/inward is not taken for /stock); null = not a configured page */
export function pageForPath(path: string): PageDef | null {
  let best: { p: PageDef; len: number } | null = null;
  for (const p of PAGES) for (const base of p.paths) {
    if ((path === base || path.startsWith(base + "/")) && (!best || base.length > best.len)) best = { p, len: base.length };
  }
  return best?.p ?? null;
}

export function canSeePage(access: AccessMap, role: Role | string | undefined, key: string): boolean {
  if (role === "admin") return true;
  const page = PAGES.find((p) => p.key === key);
  if (!page) return true;
  if (page.locked) return page.allowed.includes(role as Role);
  return (access[key] ?? []).includes(role as Role);
}

/** may this role open this path? (paths that are not configured pages – My profile – are always open) */
export function canOpenPath(access: AccessMap, role: Role | string | undefined, path: string): boolean {
  const page = pageForPath(path);
  return !page || canSeePage(access, role, page.key);
}
