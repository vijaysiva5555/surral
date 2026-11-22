/* What each role may do on each page – the admin sets it on Administration → Page access, for any page and any role:
     none – the page is hidden (not in the menu; its address leads to the dashboard)
     view – the page opens read only
     edit – the page opens with its add / edit / delete tools
   The request proxy (page loads), every API route that changes data (guardAccess in api.ts) and the screens (useCan)
   all read this map. Two things stay fixed so nobody is locked out: admins can do everything, the dashboard is open to
   all, and Page access itself is for admins only. Rules about whose record it is (sales edit their own quotations,
   only an admin deletes a sent one) still apply on top. */
import type { Role } from "./roles";

export const ACCESS_ROLES: Role[] = ["sales", "stock", "viewer"];   // admin can always do everything
export type Level = "none" | "view" | "edit";
export const LEVELS: Level[] = ["none", "view", "edit"];
const rank = (l: Level | undefined) => (l === "edit" ? 2 : l === "view" ? 1 : 0);

type Defaults = Record<"sales" | "stock" | "viewer", Level>;
export type PageDef = {
  key: string; label: string; group: string; paths: string[];
  /** false: the page only shows information, so View is the highest level */
  editable: boolean;
  /** fixed for every role other than admin */
  locked?: Level;
  defaults: Defaults;
  /** what Edit allows, shown on the Page access screen */
  editMeans?: string;
};

const d = (sales: Level, stock: Level, viewer: Level): Defaults => ({ sales, stock, viewer });

export const PAGES: PageDef[] = [
  { key: "dashboard", label: "Dashboard", group: "General", paths: ["/dashboard"], editable: false, locked: "view", defaults: d("view", "view", "view") },
  { key: "search", label: "Advanced search", group: "General", paths: ["/search"], editable: false, defaults: d("view", "view", "view") },
  { key: "customers", label: "Customers", group: "General", paths: ["/customers"], editable: true, defaults: d("edit", "view", "view"), editMeans: "Add, edit, import and delete customers and price agreements" },
  { key: "pricing", label: "Pricing (yearly)", group: "General", paths: ["/pricing"], editable: true, defaults: d("view", "view", "view"), editMeans: "Import and delete price lists" },
  { key: "hsn", label: "HSN codes", group: "General", paths: ["/hsn"], editable: true, defaults: d("edit", "view", "view"), editMeans: "Add, edit, import and delete HSN codes" },
  { key: "parts", label: "Parts master", group: "General", paths: ["/parts"], editable: true, defaults: d("view", "view", "view"), editMeans: "Add, edit and delete parts and their list prices" },
  { key: "equipmentQuotes", label: "Equipment – Quotation", group: "Equipment", paths: ["/equipment/quotations"], editable: true, defaults: d("edit", "view", "view"), editMeans: "Create, edit, share and duplicate quotations" },
  { key: "equipmentBom", label: "Equipment – BOM packages", group: "Equipment", paths: ["/equipment/bom", "/bom"], editable: true, defaults: d("edit", "none", "none"), editMeans: "Create and edit BOM packages (shows cost data)" },
  { key: "spareQuotes", label: "Spare – Quotation", group: "Spare", paths: ["/spare/quotations", "/quotations"], editable: true, defaults: d("edit", "view", "view"), editMeans: "Create, edit, share and duplicate quotations" },
  { key: "spareBom", label: "Spare – BOM packages", group: "Spare", paths: ["/spare/bom"], editable: true, defaults: d("edit", "none", "none"), editMeans: "Create and edit BOM packages (shows cost data)" },
  { key: "projectQuotes", label: "Project – Quotation", group: "Project", paths: ["/project/quotations"], editable: true, defaults: d("edit", "view", "view"), editMeans: "Create, edit and share project quotations" },
  { key: "stockInward", label: "Stock – Inward", group: "Stock", paths: ["/stock/inward"], editable: true, defaults: d("view", "edit", "view"), editMeans: "Enter, edit and delete inward entries" },
  { key: "stockOutward", label: "Stock – Outward", group: "Stock", paths: ["/stock/outward"], editable: true, defaults: d("view", "edit", "view"), editMeans: "Enter, edit and delete outward invoices" },
  { key: "stockLedger", label: "Stock – Ledger", group: "Stock", paths: ["/stock/ledger", "/stock"], editable: true, defaults: d("view", "edit", "view"), editMeans: "Edit ledger cells, add parts, import Excel, low-stock bell" },
  { key: "stockReports", label: "Stock – Reports", group: "Stock", paths: ["/stock/reports"], editable: false, defaults: d("view", "view", "view") },
  { key: "terms", label: "Terms templates", group: "Administration", paths: ["/terms"], editable: true, defaults: d("edit", "none", "none"), editMeans: "Add, edit and delete terms templates" },
  { key: "users", label: "Users", group: "Administration", paths: ["/users"], editable: true, defaults: d("none", "none", "none"), editMeans: "Add and edit users (only an admin can create or change an admin)" },
  { key: "company", label: "Company", group: "Administration", paths: ["/settings"], editable: true, defaults: d("none", "none", "none"), editMeans: "Change company details, logos and numbering" },
  { key: "audit", label: "Audit log", group: "Administration", paths: ["/audit"], editable: false, defaults: d("none", "none", "none") },
  { key: "access", label: "Page access", group: "Administration", paths: ["/access"], editable: true, locked: "none", defaults: d("none", "none", "none") },
];
const BY_KEY = new Map(PAGES.map((p) => [p.key, p]));

/** page key → level per role (admin is never stored – always edit) */
export type AccessMap = Record<string, Partial<Record<Role, Level>>>;

export const defaultAccess = (): AccessMap => Object.fromEntries(PAGES.map((p) => [p.key, { ...p.defaults }]));

/** a stored map made safe: unknown pages and values dropped, View the most for information-only pages, locked pages fixed.
    An older map (page → list of roles that may open it) is read as View / the old default level. */
export function resolveAccess(stored: unknown): AccessMap {
  const base = defaultAccess();
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Record<string, unknown>;
  for (const p of PAGES) {
    const v = s[p.key];
    for (const r of ACCESS_ROLES) {
      let level: Level | undefined;
      if (Array.isArray(v)) level = v.includes(r) ? (p.defaults[r as keyof Defaults] === "none" ? "view" : p.defaults[r as keyof Defaults]) : "none";
      else if (v && typeof v === "object") { const x = (v as Record<string, unknown>)[r]; if (LEVELS.includes(x as Level)) level = x as Level; }
      if (!level) continue;
      if (!p.editable && level === "edit") level = "view";
      base[p.key][r] = level;
    }
    if (p.locked) for (const r of ACCESS_ROLES) base[p.key][r] = p.locked;
  }
  return base;
}

export function levelOf(access: AccessMap, role: Role | string | undefined, key: string): Level {
  if (role === "admin") return "edit";
  const p = BY_KEY.get(key);
  if (!p) return "view";
  if (p.locked) return p.locked;
  return access[key]?.[role as Role] ?? "none";
}
export const hasLevel = (access: AccessMap, role: Role | string | undefined, key: string, need: "view" | "edit") => rank(levelOf(access, role, key)) >= rank(need);
export const canSeePage = (access: AccessMap, role: Role | string | undefined, key: string) => hasLevel(access, role, key, "view");

/** the page a path belongs to (longest matching path wins, so /stock/inward is not taken for /stock); null = not a configured page */
export function pageForPath(path: string): PageDef | null {
  let best: { p: PageDef; len: number } | null = null;
  for (const p of PAGES) for (const base of p.paths) {
    if ((path === base || path.startsWith(base + "/")) && (!best || base.length > best.len)) best = { p, len: base.length };
  }
  return best?.p ?? null;
}

/** may this role open this path? A "new" page needs Edit. Paths that are not configured pages (My profile) are always open. */
export function canOpenPath(access: AccessMap, role: Role | string | undefined, path: string): boolean {
  const page = pageForPath(path);
  if (!page) return true;
  return hasLevel(access, role, page.key, /\/new$/.test(path) ? "edit" : "view");
}

/** the levels one role has, page by page – what the screens get */
export type Perms = Record<string, Level>;
export const permsFor = (access: AccessMap, role: Role | string | undefined): Perms => Object.fromEntries(PAGES.map((p) => [p.key, levelOf(access, role, p.key)]));

/** the quotation page of a quotation category */
export const quotePage = (category: string | undefined | null) => (category === "equipment" ? "equipmentQuotes" : "spareQuotes");
/** the BOM page of a BOM category (a BOM without a category belongs to equipment) */
export const bomPage = (category: string | undefined | null) => (category === "spare" ? "spareBom" : "equipmentBom");
