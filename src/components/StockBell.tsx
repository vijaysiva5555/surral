"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { api } from "@/lib/client";
import { qtyText } from "@/lib/stockCalc";

type Alert = { pn: string; desc: string; location: string; balance: number; cause: string; at: string; isNew: boolean };
const when = (at: string) => new Date(at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Low-stock bell for admin and stock users. A part is listed from the moment a movement drops it to the low level
    until its balance is back above it; the red count is what arrived since the bell was last opened. */
export default function StockBell() {
  const [data, setData] = useState<{ level: number; total: number; unseen: number; items: Alert[] } | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();

  const load = useCallback(() => { api("/api/stock/alerts").then(setData).catch(() => {}); }, []);
  // refreshed on every page change, every minute, and when the tab is looked at again
  useEffect(() => { load(); }, [load, path]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  useEffect(() => { setOpen(false); }, [path]);

  function toggle() {
    const next = !open; setOpen(next);
    if (next && data?.unseen) { api("/api/stock/alerts", { method: "POST" }).catch(() => {}); setData({ ...data, unseen: 0 }); }   // the rows keep their "new" mark until the next refresh
  }

  const unseen = data?.unseen ?? 0;
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} aria-label={unseen ? `${unseen} new low-stock alert${unseen === 1 ? "" : "s"}` : "Low-stock alerts"} aria-expanded={open}
        className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:border-brand-200 hover:bg-brand-50/50">
        <Bell className="h-5 w-5" />
        {unseen > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{unseen > 99 ? "99+" : unseen}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="font-semibold text-slate-900">Low stock</div>
            <div className="text-xs text-slate-500">Parts that dropped to {data?.level ?? 3} or less</div>
          </div>
          {!data || data.items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-400">No part has dropped to low stock.</p> : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {data.items.map((a) => (
                <li key={a.pn} className={`flex items-start gap-3 px-4 py-3 ${a.isNew ? "bg-amber-50/60" : ""}`}>
                  <span className={`mt-0.5 flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm font-bold tabular-nums ${a.balance <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{qtyText(a.balance)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold text-slate-900">{a.pn}{a.location && <span className="ml-2 font-sans font-normal text-slate-400">{a.location}</span>}</div>
                    <div className="truncate text-sm text-slate-600">{a.desc || "—"}</div>
                    <div className="text-xs text-slate-400">{a.balance <= 0 ? "Out of stock" : `${qtyText(a.balance)} left`}{a.cause && ` · ${a.cause}`} · {when(a.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">{data && data.total > data.items.length ? `${data.total} parts in all` : ""}</span>
            <Link href="/stock/ledger?level=low" className="font-medium text-brand-600 hover:text-brand-700">All low-stock parts</Link>
          </div>
        </div>
      )}
    </div>
  );
}
