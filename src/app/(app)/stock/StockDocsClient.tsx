"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import { api } from "@/lib/client";
import { dayLabel, qtyText } from "@/lib/stockCalc";
import { useDebouncedLoad } from "@/lib/useDebouncedLoad";

type Line = { pn: string; desc: string; qty: number };
type Doc = { _id: string; no: string; date: string; party: string; remarks?: string; lines: Line[]; qtyTotal: number; createdByName?: string; imported?: boolean };
export const DOC_UI = {
  in: { title: "Inward", one: "inward entry", party: "Supplier", path: "/stock/inward", noLabel: "Invoice no.", sub: "Goods received – every entry adds to the stock ledger on its invoice date" },
  out: { title: "Outward", one: "outward invoice", party: "Customer", path: "/stock/outward", noLabel: "Invoice no.", sub: "Goods sent out – every invoice reduces the stock ledger on its invoice date" },
} as const;

export default function StockDocsClient({ type, canEdit }: { type: "in" | "out"; canEdit: boolean }) {
  const ui = DOC_UI[type];
  const [items, setItems] = useState<Doc[]>([]);
  const [q, setQ] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api(`/api/stock/docs?type=${type}&q=${encodeURIComponent(q)}&from=${from}&to=${to}&page=${page}`); setItems(r.items); setPages(r.pages); setTotal(r.total); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setLoading(false);
  }, [type, q, from, to, page]);
  useDebouncedLoad(load, [load]);
  useEffect(() => { setPage(1); }, [q, from, to]);

  async function remove(d: Doc) {
    if (!confirm(`Delete ${ui.one} ${d.no} (${dayLabel(d.date)})?\n\n${type === "out" ? "Its quantities go back into stock." : "Its quantities are taken out of stock again."} This cannot be undone.`)) return;
    setBusy(d._id);
    try { await api(`/api/stock/docs/${d._id}`, { method: "DELETE" }); setMsg({ ok: true, text: `Deleted ${ui.one} ${d.no}.` }); load(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy("");
  }

  return (
    <>
      <PageHeader title={ui.title} subtitle={ui.sub}>
        {canEdit && <Link href={`${ui.path}/new`} className="btn-primary"><Plus className="h-4 w-4" />New {ui.one}</Link>}
      </PageHeader>
      {msg && <div className={`mb-4 flex items-center justify-between rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}<button onClick={() => setMsg(null)}><X className="h-4 w-4" /></button></div>}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder={`Search invoice no., ${ui.party.toLowerCase()}, part no. or description…`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div><label className="label">From</label><input type="date" className="input sm:!w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="label">To</label><input type="date" className="input sm:!w-40" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th sm:w-36">{ui.noLabel}</th><th className="th hidden sm:table-cell w-28">Date</th><th className="th">{ui.party}</th><th className="th hidden xl:table-cell">Items</th><th className="th w-16 text-right sm:w-24">Qty</th><th className="th w-12 sm:w-28" /></tr></thead>
            <tbody>
              {loading && items.length === 0 && <tr><td colSpan={6} className="td text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-slate-400">No {ui.one === "inward entry" ? "inward entries" : "outward invoices"} found{q || from || to ? " for this search" : " yet"}.</td></tr>}
              {items.map((d) => (
                <tr key={d._id} className="hover:bg-slate-50">
                  <td className="td"><Link href={`${ui.path}/${d._id}`} className="break-all font-medium text-brand-700">{d.no || "—"}</Link><div className="whitespace-nowrap text-xs tabular-nums text-slate-500 sm:hidden">{dayLabel(d.date)}</div></td>
                  <td className="td hidden sm:table-cell whitespace-nowrap tabular-nums">{dayLabel(d.date)}</td>
                  <td className="td">{d.party || "—"}{d.remarks && <div className="text-xs text-slate-500">{d.remarks}</div>}<div className="text-xs text-slate-400 xl:hidden">{d.lines.length} item{d.lines.length === 1 ? "" : "s"}</div></td>
                  <td className="td hidden max-w-xs text-slate-600 xl:table-cell">
                    <div className="truncate">{d.lines.slice(0, 3).map((l) => l.pn || l.desc).join(", ")}{d.lines.length > 3 && ` +${d.lines.length - 3} more`}</div>
                    <div className="text-xs text-slate-400">{d.lines.length} item{d.lines.length === 1 ? "" : "s"}</div>
                  </td>
                  <td className="td text-right font-medium tabular-nums">{qtyText(d.qtyTotal)}</td>
                  <td className="td whitespace-nowrap !px-2 text-right sm:!px-4">
                    <Link href={`${ui.path}/${d._id}`} title={canEdit ? "Edit" : "View"} className="inline-block p-1.5 text-slate-500 hover:text-brand-600">{canEdit ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Link>
                    {canEdit && <button title="Delete" disabled={busy === d._id} className="hidden p-1.5 text-slate-500 hover:text-red-600 sm:inline-block" onClick={() => remove(d)}>{busy === d._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 0 && <Pager page={page} pages={pages} total={total} set={setPage} />}
      </div>
    </>
  );
}
