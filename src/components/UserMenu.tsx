"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, Loader2, LogOut, UserRound } from "lucide-react";
import { ROLE_LABEL, type Role } from "@/lib/roles";

/** The signed-in user in the header: opens a small menu with My profile and Sign out. */
export default function UserMenu({ name, role }: { name: string; role: Role }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 py-1.5 pl-1.5 pr-2.5 transition hover:border-brand-200 hover:bg-brand-50/50 sm:gap-3 sm:pr-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-sm">{initial}</span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium text-slate-800">{name}</span>
          <span className="block text-xs text-slate-500">{ROLE_LABEL[role] ?? role}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white">{initial}</span>
            <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-900">{name}</div><div className="text-xs text-slate-500">{ROLE_LABEL[role] ?? role}</div></div>
          </div>
          <div className="p-1.5">
            <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <UserRound className="h-4 w-4 text-slate-400" />My profile
            </Link>
            <button type="button" role="menuitem" disabled={leaving} onClick={() => { setLeaving(true); signOut({ callbackUrl: "/login" }); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
              {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}{leaving ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
