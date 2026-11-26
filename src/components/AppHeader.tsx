"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, PanelLeftOpen } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import StockBell from "@/components/StockBell";
import { type Role } from "@/lib/roles";
import { useCan } from "@/components/PermsContext";
import { breadcrumbs } from "@/lib/breadcrumbs";

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
  const can = useCan();
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
              <span key={`${i}-${c.href}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                {i === crumbs.length - 1 ? (
                  <span className="font-semibold text-slate-800" aria-current="page">{c.label}</span>
                ) : !c.href ? (
                  <span className="text-slate-500">{c.label}</span>
                ) : (
                  <Link href={c.href} className="hover:text-brand-600">
                    {c.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>
        {can("stockLedger", "edit") && <StockBell />}
        <UserMenu name={name} role={role} />
      </div>
    </header>
  );
}
