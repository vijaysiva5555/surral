"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileDown, Loader2, Plus, Search, Share2, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { dmy, inr0 } from "@/lib/format";
import { QUOTE_STATUS_PATCH, quoteStatusLabel } from "@/lib/quoteStatus";
import StatusBadge from "@/components/StatusBadge";
import Pager from "@/components/Pager";

type Row = { _id: string; number: string; date: string; status: string; customer?: { name?: string }; subject?: string; totals?: { total?: number } };

export default function ProjectQuotationsClient({ role }: { role: "admin" | "sales" | "viewer" }) {
  const [items, setItems] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const sp = new URLSearchParams({ page: String(page) });
      if (q.trim()) sp.set("q", q.trim());
      if (status) sp.set("status", status);
      const r = await api(`/api/project-quotes?${sp}`);
      setItems(r.items); setPages(r.pages || 1); setTotal(r.total || 0);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [page, q, status]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function share(id: string) {
    try {
      const r = await api(`/api/project-quotes/${id}/share`, { method: "POST" });
      const url = `${location.origin}/pq/${r.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setMsg(`Share link copied: ${url}`);
    } catch (e) { setErr((e as Error).message); }
  }

  async function remove(row: Row) {
    if (!confirm(`Delete ${row.number}? This cannot be undone.`)) return;
    try { await api(`/api/project-quotes/${row._id}`, { method: "DELETE" }); load(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Project quotations</h1>
          <p className="text-sm text-slate-500">System offers, technical descriptions and offer totals in the letter format.</p>
        </div>
        {role !== "viewer" && <Link href="/project/quotations/new" className="btn-primary"><Plus className="h-4 w-4" />New project quotation</Link>}
      </div>

      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="mb-4 break-all rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search number, customer or subject…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <select className="input !w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {QUOTE_STATUS_PATCH.map((s) => <option key={s} value={s}>{quoteStatusLabel(s)}</option>)}
          </select>
          <span className="text-sm text-slate-500">{total} offer{total === 1 ? "" : "s"}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Offer</th><th className="th">Date</th><th className="th">Customer</th><th className="th">Subject</th>
                <th className="th text-right">Total ₹</th><th className="th">Status</th><th className="th w-32" />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="td text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={7} className="td py-12 text-center text-slate-400">No project quotations yet.</td></tr>}
              {items.map((row) => (
                <tr key={row._id} className="hover:bg-slate-50">
                  <td className="td font-medium"><Link href={`/project/quotations/${row._id}`} className="text-brand-700 hover:underline">{row.number}</Link></td>
                  <td className="td tabular-nums">{dmy(row.date)}</td>
                  <td className="td">{row.customer?.name ?? "—"}</td>
                  <td className="td max-w-[22rem] truncate text-slate-600" title={row.subject}>{row.subject || "—"}</td>
                  <td className="td text-right tabular-nums">{inr0(row.totals?.total)}</td>
                  <td className="td"><StatusBadge status={row.status} /></td>
                  <td className="td text-right">
                    <a className="inline-block p-1.5 text-slate-500 hover:text-brand-600" title="PDF" href={`/api/project-quotes/${row._id}/pdf?inline=1`} target="_blank"><FileDown className="h-4 w-4" /></a>
                    {role !== "viewer" && <button className="p-1.5 text-slate-500 hover:text-brand-600" title="Share link" onClick={() => share(row._id)}><Share2 className="h-4 w-4" /></button>}
                    {(role === "admin" || row.status === "draft") && role !== "viewer" && (
                      <button className="p-1.5 text-slate-500 hover:text-red-600" title="Delete" onClick={() => remove(row)}><Trash2 className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && <div className="border-t border-slate-200 p-3"><Pager page={page} pages={pages} total={total} set={setPage} /></div>}
      </div>
    </>
  );
}
