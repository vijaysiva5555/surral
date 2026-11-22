"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Tags,
  UserCog,
  Building2,
  LogOut,
  ScrollText,
  Hash,
  ListChecks,
  Layers,
  Package,
  PanelLeftClose,
  FolderKanban,
  SearchCheck,
  ChevronDown,
  PackagePlus,
  PackageMinus,
  Sheet,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { canSell, type Role } from "@/lib/roles";
import { pageForPath } from "@/lib/pageAccess";

/** admin: admin only · sell: needs the sales side (admin / sales) – BOM packages and terms hold cost data and editing tools */
type NavItem = { href: string; label: string; icon: typeof FileText; admin?: boolean; sell?: boolean };
type NavGroup = { key: string; title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { key: "general", title: "General", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/search", label: "Advanced search", icon: SearchCheck },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/pricing", label: "Pricing (yearly)", icon: Tags },
    { href: "/hsn", label: "HSN codes", icon: Hash },
    { href: "/parts", label: "Parts master", icon: Package },
  ] },
  { key: "equipment", title: "Equipment", items: [
    { href: "/equipment/quotations", label: "Quotation", icon: FileText },
    { href: "/equipment/bom", label: "BOM packages", icon: Layers, sell: true },
  ] },
  { key: "spare", title: "Spare", items: [
    { href: "/spare/quotations", label: "Quotation", icon: FileText },
    { href: "/spare/bom", label: "BOM packages", icon: Layers, sell: true },
  ] },
  { key: "project", title: "Project", items: [
    { href: "/project/quotations", label: "Quotation", icon: FolderKanban },
  ] },
  { key: "stock", title: "Stock", items: [
    { href: "/stock/inward", label: "Inward", icon: PackagePlus },
    { href: "/stock/outward", label: "Outward", icon: PackageMinus },
    { href: "/stock/ledger", label: "Ledger", icon: Sheet },
    { href: "/stock/reports", label: "Reports", icon: FileSpreadsheet },
  ] },
  { key: "admin", title: "Administration", items: [
    { href: "/users", label: "Users", icon: UserCog, admin: true },
    { href: "/settings", label: "Company", icon: Building2, admin: true },
    { href: "/terms", label: "Terms templates", icon: ListChecks, sell: true },
    { href: "/audit", label: "Audit log", icon: ScrollText, admin: true },
    { href: "/access", label: "Page access", icon: ShieldCheck, admin: true },
  ] },
];

const NAV_STORAGE_KEY = "surral-nav-groups";
/** the menu item of the page being shown: the same address, or a page under it (a quotation under its list) */
const isActive = (path: string, href: string) => path === href || (href !== "/dashboard" && path.startsWith(href + "/"));

export default function Sidebar({
  role,
  pages,
  mobileOpen = false,
  desktopOpen = true,
  onNavigate,
  onToggleDesktop,
}: {
  name?: string;
  role: Role;
  /** keys of the pages this role may open (Administration → Page access) */
  pages?: string[];
  mobileOpen?: boolean;
  desktopOpen?: boolean;
  onNavigate?: () => void;
  onToggleDesktop?: () => void;
}) {
  const path = usePathname();
  const lgClosed = !desktopOpen && !mobileOpen;

  const allowedPage = (href: string) => { const pg = pageForPath(href); return !pg || !pages || pages.includes(pg.key); };
  // the pages this role may open come from Administration → Page access; the admin / sell flags only apply when that is unknown
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => (pages ? allowedPage(n.href) : (!n.admin || role === "admin") && (!n.sell || canSell(role)))) })).filter((g) => g.items.length > 0);
  const activeKey = groups.find((g) => g.items.some((n) => isActive(path, n.href)))?.key;

  // which groups the user has opened / closed by hand; anything not listed follows the default (General open, the rest closed)
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { const s = localStorage.getItem(NAV_STORAGE_KEY); if (s) setChosen(JSON.parse(s)); } catch { /* ignore */ }
  }, []);
  // arriving on a page always shows its own group, even if it was closed earlier
  useEffect(() => { if (activeKey) setChosen((c) => (c[activeKey] === false ? { ...c, [activeKey]: true } : c)); }, [activeKey]);

  const openIn = (c: Record<string, boolean>, key: string) => c[key] ?? (key === "general" || key === activeKey);
  const isOpen = (key: string) => openIn(chosen, key);
  function toggle(key: string) {
    setChosen((c) => {
      const next = { ...c, [key]: !openIn(c, key) };
      try { localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <aside
      className={`app-sidebar${mobileOpen ? " app-sidebar-open" : ""}${lgClosed ? " app-sidebar-lg-closed" : ""}`}
    >
      <div className="flex items-center gap-3 border-b border-slate-200/80 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sscpl-logo.png" alt="" className="h-11 rounded-lg border border-slate-100 bg-white p-0.5 shadow-sm" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-semibold text-slate-900">Surral Quote</div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Quotation Manager</div>
        </div>
        {onToggleDesktop && (
          <button
            type="button"
            onClick={onToggleDesktop}
            className="hidden shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 lg:inline-flex"
            aria-label="Hide sidebar"
            title="Hide sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {groups.map((g) => {
          const open = isOpen(g.key);
          const holdsCurrent = g.key === activeKey;
          return (
            <div key={g.key}>
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={open}
                aria-controls={`nav-group-${g.key}`}
                className={`nav-group-toggle ${holdsCurrent ? "nav-group-current" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-2"><span className="truncate">{g.title}</span>{holdsCurrent && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(10,165,232,0.8)]" aria-hidden />}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ${open ? "" : "-rotate-90"}`} />
              </button>
              {open && (
                <div id={`nav-group-${g.key}`} className="mt-0.5 space-y-0.5">
                  {g.items.map(({ href, label, icon: Icon }) => {
                    const active = isActive(path, href);
                    return (
                      <Link key={href} href={href} className={`nav-link ${active ? "nav-link-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onNavigate}>
                        <span className="nav-icon"><Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.75} /></span>
                        <span className="truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-200/80 p-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="nav-link w-full text-slate-500 hover:text-red-600"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
