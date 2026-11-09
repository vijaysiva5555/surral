"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { inr, pct } from "@/lib/format";
import { Pager } from "./PartsTab";

type PL = { _id: string; year: number; name: string; effectiveFrom: string };
type Row = { key: string; pn: string; pga: string; a: number | null; b: number | null; pct: number | null; part: { desc: string; division: string; discountCode: string } | null };

export default function CompareTab() {
  const [lists, setLists] = useState<PL[]>([]);
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [kind, setKind] = useState<"changed" | "added" | "removed">("changed");
  const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const [data, setData] = useState<{ summary: Record<string, number>; items: Row[]; total: number; pages: number } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { api("/api/pricing/lists").then((r) => { const s: PL[] = [...r.items].sort((x: PL, y: PL) => +new Date(x.effectiveFrom) - +new Date(y.effectiveFrom)); setLists(s); if (s.length >= 2) { setA(s[s.length - 2]._id); setB(s[s.length - 1]._id); } }); }, []);
  useEffect(() => { setPage(1); }, [a, b, kind, q]);
  useEffect(() => {
    if (!a || !b) return;
    setErr("");
    const t = setTimeout(() => api(`/api/pricing/compare?a=${a}&b=${b}&kind=${kind}&q=${encodeURIComponent(q)}&page=${page}`).then(setData).catch((e) => setErr(e.message)), 250);
    return () => clearTimeout(t);
  }, [a, b, kind, q, page]);

  if (lists.length < 2) return <p className="card p-8 text-center text-slate-500">Import at least two price lists to compare them.</p>;
  const s = data?.summary;
  const KINDS = [["changed", "Price changed", s?.changed], ["added", "New parts", s?.added], ["removed", "Dropped", s?.removed]] as const;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label">From (older)</label><select className="input w-64" value={a} onChange={(e) => setA(e.target.value)}>{lists.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}</select></div>
        <div><label className="label">To (newer)</label><select className="input w-64" value={b} onChange={(e) => setB(e.target.value)}>{lists.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}</select></div>
      </div>
      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {s && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="card p-4"><div className="text-xs text-slate-500">Average price change</div><div className="text-2xl font-bold">{pct(s.avgPct)}</div></div>
          <div className="card p-4"><div className="text-xs text-slate-500">Median change</div><div className="text-2xl font-bold">{pct(s.medianPct)}</div></div>
          <div className="card p-4"><div className="text-xs text-slate-500">Unchanged</div><div className="text-2xl font-bold">{s.unchanged.toLocaleString("en-IN")}</div></div>
          <div className="card p-4"><div className="text-xs text-slate-500">Parts (A → B)</div><div className="text-2xl font-bold">{s.listA.toLocaleString("en-IN")} → {s.listB.toLocaleString("en-IN")}</div></div>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">{KINDS.map(([k, label, n]) => <button key={k} onClick={() => setKind(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-white shadow-sm" : "text-slate-500"}`}>{label}{n !== undefined && <span className="ml-1.5 text-xs text-slate-400">{n.toLocaleString("en-IN")}</span>}</button>)}</div>
          <input className="input max-w-xs" placeholder="Filter by part number…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className="w-full">
          <thead><tr><th className="th">Part no.</th><th className="th">Description</th><th className="th">Disc.</th><th className="th text-right">Old ₹</th><th className="th text-right">New ₹</th><th className="th text-right">Change</th></tr></thead>
          <tbody>
            {data?.items.map((r) => (
              <tr key={r.key} className="hover:bg-slate-50">
                <td className="td font-mono text-xs font-medium">{r.pn}</td>
                <td className="td max-w-sm">{r.part?.desc}<div className="text-[11px] text-slate-400">{r.pga}</div></td>
                <td className="td text-xs">{r.part?.discountCode}</td>
                <td className="td text-right tabular-nums">{inr(r.a)}</td><td className="td text-right tabular-nums">{inr(r.b)}</td>
                <td className={`td text-right font-medium ${r.pct == null ? "" : r.pct > 0 ? "text-red-600" : "text-emerald-600"}`}>{pct(r.pct)}</td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-slate-400">Nothing to show.</td></tr>}
          </tbody>
        </table>
        {data && <Pager page={page} pages={data.pages} total={data.total} set={setPage} />}
      </div>
    </>
  );
}
