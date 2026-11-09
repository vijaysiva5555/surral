"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AppHeader from "@/components/AppHeader";

type Role = "admin" | "sales" | "viewer";

const SIDEBAR_STORAGE_KEY = "surral-sidebar-open";

export default function AppShell({
  name,
  role,
  children,
}: {
  name: string;
  role: Role;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const path = usePathname();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === "0") setDesktopSidebarOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, desktopSidebarOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [desktopSidebarOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <Sidebar
        role={role}
        mobileOpen={menuOpen}
        desktopOpen={desktopSidebarOpen}
        onNavigate={() => setMenuOpen(false)}
        onToggleDesktop={() => setDesktopSidebarOpen((v) => !v)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          name={name}
          role={role}
          sidebarOpen={desktopSidebarOpen}
          onMenuClick={() => setMenuOpen(true)}
          onSidebarToggle={() => setDesktopSidebarOpen((v) => !v)}
        />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
