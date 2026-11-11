"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, PanelLeftOpen, UserCircle } from "lucide-react";

const SEGMENTS: Record<string, string> = {
  dashboard: "Dashboard",
  spare: "Spare",
  equipment: "Equipment",
  quotations: "Quotations",
  new: "New",
  customers: "Customers",
  pricing: "Pricing",
  bom: "BOM packages",
  hsn: "HSN codes",
  users: "Users",
  settings: "Company",
  terms: "Terms templates",
  audit: "Audit log",
  profile: "Profile",
};

function breadcrumbs(path: string): { href: string; label: string }[] {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return [{ href: "/dashboard", label: "Dashboard" }];
  const out: { href: string; label: string }[] = [{ href: "/dashboard", label: "Home" }];
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    acc += `/${parts[i]}`;
    const seg = parts[i];
    if (/^[a-f0-9]{24}$/i.test(seg)) {
      out.push({ href: acc, label: "Details" });
      continue;
    }
    out.push({ href: acc, label: SEGMENTS[seg] ?? seg });
  }
  return out;
}

type Role = "admin" | "sales" | "viewer";

export default function AppHeader({
  name,
  role,
  sidebarOpen = true,
  onMenuClick,
  onSidebarToggle,
}: {
  name: string;
  role: Role;
  sidebarOpen?: boolean;
  onMenuClick?: () => void;
  onSidebarToggle?: () => void;
}) {
  const path = usePathname();
  const crumbs = breadcrumbs(path);
  const current = crumbs[crumbs.length - 1]?.label ?? "Home";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onMenuClick && (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {onSidebarToggle && !sidebarOpen && (
            <button
              type="button"
              className="hidden shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 lg:inline-flex"
              onClick={onSidebarToggle}
              aria-label="Show sidebar"
              title="Show sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          )}
          <span className="truncate text-sm font-semibold text-slate-800 sm:hidden">{current}</span>
          <nav className="hidden min-w-0 flex-wrap items-center gap-1 text-sm text-slate-500 sm:flex">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                {i === crumbs.length - 1 ? (
                  <span className="font-semibold text-slate-800">{c.label}</span>
                ) : (
                  <Link href={c.href} className="hover:text-brand-600">
                    {c.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50/50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[10rem] truncate text-sm font-medium text-slate-800">{name}</span>
            <span className="block text-xs capitalize text-slate-500">{role}</span>
          </span>
          <UserCircle className="h-5 w-5 text-slate-400 sm:hidden" />
        </Link>
      </div>
    </header>
  );
}
