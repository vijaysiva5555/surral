"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { inr } from "@/lib/format";

export type PickedPart = { hsn?: string; pn: string; pga: string; desc: string; discountCode?: string; itemStatus?: string; costDiscountPct: number | null; price: number | null };

/** Type-ahead search over the Graco parts master, priced from the chosen price list */
export default function PartPicker({ listId, placeholder = "Search Graco part number or description…", onPick, autoFocus }: { listId?: string; placeholder?: string; onPick: (p: PickedPart) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState(""); const [res, setRes] = useState<any[]>([]); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); // eslint-disable-line @typescript-eslint/no-explicit-any
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    setBusy(true);
    const t = setTimeout(() => api(`/api/parts?q=${encodeURIComponent(q.trim())}&limit=8${listId ? `&listIds=${listId}` : ""}`).then((r) => { setRes(r.items); setOpen(true); }).finally(() => setBusy(false)), 250);
    return () => clearTimeout(t);
  }, [q, listId]);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);

  return (
    <div ref={box} className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input autoFocus={autoFocus} className="input pl-9" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => res.length && setOpen(true)} />
      {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      {open && (
        <div className="absolute z-30 mt-1 max-h-80 w-full min-w-0 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg sm:min-w-[28rem] sm:max-w-none">
          {res.length === 0 && <div className="p-4 text-sm text-slate-400">No parts found.</div>}
          {res.map((p) => {
            const price = listId ? p.prices[listId] ?? null : null;
            return (
              <button key={p._id} type="button" className="flex w-full items-start justify-between gap-4 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-brand-50"
                onClick={() => { onPick({ hsn: p.hsn ?? "", pn: p.pn, pga: p.pga, desc: p.desc, discountCode: p.discountCode, itemStatus: p.itemStatus, costDiscountPct: p.costDiscountPct, price }); setQ(""); setRes([]); setOpen(false); }}>
                <div className="min-w-0"><div className="font-mono text-xs font-semibold text-slate-900">{p.pn} <span className="ml-1 font-sans font-normal text-slate-400">{p.discountCode}</span></div><div className="truncate text-sm text-slate-600">{p.desc}</div>
                  {p.itemStatus && !/ACTIVE/i.test(p.itemStatus) && <div className="text-[11px] font-medium text-amber-600">{p.itemStatus}</div>}</div>
                <div className="shrink-0 text-right text-sm tabular-nums">{price != null ? `₹${inr(price)}` : <span className="text-xs text-red-500">no price in this list</span>}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
