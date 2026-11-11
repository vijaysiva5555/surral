"use client";
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
} from "lucide-react";

type Role = "admin" | "sales" | "viewer";

type NavItem = { href: string; label: string; icon: typeof FileText; soon?: boolean; admin?: boolean; noViewer?: boolean };

const GENERAL: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Advanced search", icon: SearchCheck },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/pricing", label: "Pricing (yearly)", icon: Tags },
  { href: "/hsn", label: "HSN codes", icon: Hash },
];

const EQUIPMENT: NavItem[] = [
  { href: "/equipment/quotations", label: "Quotation", icon: FileText },
  { href: "/equipment/bom", label: "BOM packages", icon: Layers, noViewer: true },
];

const SPARE: NavItem[] = [
  { href: "/spare/quotations", label: "Quotation", icon: FileText },
  { href: "/spare/bom", label: "BOM packages", icon: Layers, noViewer: true },
];

const PROJECT: NavItem[] = [
  { href: "/project/quotations", label: "Quotation", icon: FolderKanban },
];

const ADMIN: NavItem[] = [
  { href: "/users", label: "Users", icon: UserCog, admin: true },
  { href: "/parts", label: "Parts master", icon: Package, admin: true },
  { href: "/settings", label: "Company", icon: Building2, admin: true },
  { href: "/terms", label: "Terms templates", icon: ListChecks, noViewer: true },
  { href: "/audit", label: "Audit log", icon: ScrollText, admin: true },
];

function NavSection({
  title,
  items,
  role,
  path,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  role: Role;
  path: string;
  onNavigate?: () => void;
}) {
  const visible = items.filter((n) => (!n.admin || role === "admin") && !(n.noViewer && role === "viewer"));
  if (visible.length === 0) return null;
  return (
  <>
      <div className="nav-section-title">{title}</div>
      {visible.map(({ href, label, icon: Icon, soon }) => {
        const active = path === href || (href !== "/dashboard" && path.startsWith(href));
        const cls = `nav-link ${active ? "nav-link-active" : ""} ${soon ? "pointer-events-none opacity-50" : ""}`;
        return (
          <Link key={`${title}-${href}`} href={soon ? "#" : href} className={cls} onClick={onNavigate}>
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
            <span className="truncate">{label}</span>
            {soon && <span className="ml-auto rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">Soon</span>}
          </Link>
        );
      })}
    </>
  );
}

export default function Sidebar({
  role,
  mobileOpen = false,
  desktopOpen = true,
  onNavigate,
  onToggleDesktop,
}: {
  name?: string;
  role: Role;
  mobileOpen?: boolean;
  desktopOpen?: boolean;
  onNavigate?: () => void;
  onToggleDesktop?: () => void;
}) {
  const path = usePathname();
  const lgClosed = !desktopOpen && !mobileOpen;
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
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <NavSection title="General" items={GENERAL} role={role} path={path} onNavigate={onNavigate} />
        <NavSection title="Equipment" items={EQUIPMENT} role={role} path={path} onNavigate={onNavigate} />
        <NavSection title="Spare" items={SPARE} role={role} path={path} onNavigate={onNavigate} />
        <NavSection title="Project" items={PROJECT} role={role} path={path} onNavigate={onNavigate} />
        <NavSection title="Administration" items={ADMIN} role={role} path={path} onNavigate={onNavigate} />
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
