/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { X, Search, Loader2, Layers } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/client";
import { dmy, inr0 } from "@/lib/format";

import type { QuoteCategory } from "@/lib/quoteCategory";

/** Choose a saved BOM package for a quotation line. Returns the full BOM (items included). */
export default function BomPicker({
  category,
  bomBasePath,
  onPick,
  onClose,
}: {
  category: QuoteCategory;
  bomBasePath: string;
  onPick: (bom: any) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(""); const [items, setItems] = useState<any[] | null>(null); const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { const t = setTimeout(() => api(`/api/bom?category=${category}&q=${encodeURIComponent(q)}`).then((r) => setItems(r.items)).catch((e) => setErr(e.message)), 200); return () => clearTimeout(t); }, [q, category]);
  async function pick(b: any) { setBusy(b._id); try { onPick((await api(`/api/bom/${b._id}`)).item); } catch (e) { setErr((e as Error).message); setBusy(""); } }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="text-lg font-semibold">Choose a BOM package</h2><button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button></div>
        <div className="relative border-b border-slate-200 p-4"><Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus className="input pl-9" placeholder="Search BOMs…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex-1 overflow-y-auto">
          {err && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          {!items && <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>}
          {items?.length === 0 && <div className="p-10 text-center text-sm text-slate-400"><Layers className="mx-auto mb-2 h-8 w-8" />No BOMs found. <Link href={`${bomBasePath}/new`} target="_blank" className="font-medium text-brand-700">Create one</Link></div>}
          {items?.map((b) => (
            <button key={b._id} onClick={() => pick(b)} disabled={!!busy} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-6 py-3 text-left last:border-0 hover:bg-brand-50 disabled:opacity-60">
              <div className="min-w-0"><div className="truncate font-medium text-slate-900">{b.name}</div><div className="text-xs text-slate-500">{b.summary.count} items · BOM dated {dmy(b.date)} · landed ₹{inr0(b.summary.landed)}</div></div>
              <div className="shrink-0 text-right">{busy === b._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><div className="font-semibold tabular-nums">₹{inr0(b.summary.price)}</div><div className="text-xs text-slate-400">total unit price</div></>}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
