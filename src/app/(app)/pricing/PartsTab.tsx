"use client";
import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import Pager from "@/components/Pager";
import { inr, pct } from "@/lib/format";

type PL = { _id: string; year: number; effectiveFrom: string };
type P = { _id: string; pn: string; pga: string; desc: string; division: string; discountCode: string; itemStatus: string; prices: Record<string, number>; costDiscountPct: number | null };

export default function PartsTab() {
  const [lists, setLists] = useState<PL[]>([]);
  const [meta, setMeta] = useState<{ divisions: string[]; statuses: string[] }>({ divisions: [], statuses: [] });
  const [q, setQ] = useState(""); const [division, setDivision] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: P[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api("/api/pricing/lists").then((r) => setLists([...r.items].sort((a: PL, b: PL) => a.year - b.year))); api("/api/parts?meta=1").then(setMeta); }, []);
  useEffect(() => { setPage(1); }, [q, division, status]);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => api(`/api/parts?q=${encodeURIComponent(q)}&division=${division}&status=${encodeURIComponent(status)}&page=${page}`).then(setData).finally(() => setLoading(false)), 250);
    return () => clearTimeout(t);
  }, [q, division, status, page]);

  const last2 = lists.slice(-2);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
        <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Part number or description…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input w-40" value={division} onChange={(e) => setDivision(e.target.value)}><option value="">All divisions</option>{meta.divisions.map((d) => <option key={d}>{d}</option>)}</select>
        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{meta.statuses.map((d) => <option key={d}>{d}</option>)}</select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Part no.</th><th className="th">Description</th><th className="th">Div</th><th className="th">Disc. code</th><th className="th">Status</th>
            {lists.map((l) => <th key={l._id} className="th text-right">{l.year} list ₹</th>)}{last2.length === 2 && <th className="th text-right">Δ</th>}</tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan={9} className="td text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
            {data?.items.length === 0 && <tr><td colSpan={9} className="td py-10 text-center text-slate-400">No parts found.</td></tr>}
            {data?.items.map((p) => {
              const [a, b] = last2.map((l) => p.prices[l._id]);
              return (
                <tr key={p._id} className="hover:bg-slate-50">
                  <td className="td font-mono text-xs font-medium text-slate-900">{p.pn}</td>
                  <td className="td max-w-xs">{p.desc}<div className="text-[11px] text-slate-400">{p.pga}</div></td>
                  <td className="td">{p.division}</td>
                  <td className="td"><span className="badge bg-slate-100 text-slate-700">{p.discountCode}</span>{p.costDiscountPct !== null && <span className="ml-1 text-xs text-slate-400">{p.costDiscountPct}%</span>}</td>
                  <td className="td text-xs">{p.itemStatus}</td>
                  {lists.map((l) => <td key={l._id} className="td text-right tabular-nums">{inr(p.prices[l._id])}</td>)}
                  {last2.length === 2 && <td className={`td text-right text-xs font-medium ${a && b && b > a ? "text-red-600" : "text-emerald-600"}`}>{a && b ? pct(((b - a) / a) * 100) : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data && <Pager page={page} pages={data.pages} total={data.total} set={setPage} />}
    </div>
  );
}

