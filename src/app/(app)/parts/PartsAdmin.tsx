"use client";
import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import { api } from "@/lib/client";
import { dmy, inr } from "@/lib/format";

type PL = { _id: string; year: number; name: string; effectiveFrom: string };
type Row = { _id: string; pn: string; pga: string; desc: string; division: string; discountCode: string; itemStatus: string; hsn: string; costDiscountPct: number | null; prices: Record<string, number> };
type Price = { priceListId: string; listPrice: number | null };
type Form = {
  _id?: string; pn: string; pga: string; desc: string; division: string; application: string; discountCode: string;
  sbu: string; familyCode: string; itemStatus: string; recordType: string; hsn: string; partnerDiscountPct: number | null; prices: Price[];
};

export default function PartsAdmin() {
  const [lists, setLists] = useState<PL[]>([]);
  const [meta, setMeta] = useState<{ divisions: string[]; statuses: string[] }>({ divisions: [], statuses: [] });
  const [q, setQ] = useState(""); const [division, setDivision] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Row[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true); const [tick, setTick] = useState(0);
  const [form, setForm] = useState<Form | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    api("/api/pricing/lists").then((r) => setLists([...r.items].sort((a: PL, b: PL) => +new Date(a.effectiveFrom) - +new Date(b.effectiveFrom))));
    api("/api/parts?meta=1").then(setMeta);
  }, []);
  useEffect(() => { setPage(1); }, [q, division, status]);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => api(`/api/parts?q=${encodeURIComponent(q)}&division=${encodeURIComponent(division)}&status=${encodeURIComponent(status)}&page=${page}&limit=50`).then(setData).finally(() => setLoading(false)), 250);
    return () => clearTimeout(t);
  }, [q, division, status, page, tick]);

  const latest = lists.length ? lists[lists.length - 1] : null;
  const blank = (): Form => ({
    pn: "", pga: "", desc: "", division: "", application: "", discountCode: "", sbu: "", familyCode: "",
    itemStatus: "ACTIVE", recordType: "", hsn: "", partnerDiscountPct: null, prices: lists.map((l) => ({ priceListId: l._id, listPrice: null })),
  });

  async function edit(row: Row) {
    setErr(""); setBusy(true);
    try {
      const r = await api(`/api/parts/${row._id}`);
      const saved = new Map<string, number>((r.item.prices ?? []).map((p: Price) => [String(p.priceListId), p.listPrice as number]));
      setForm({ ...r.item, partnerDiscountPct: r.item.partnerDiscountPct ?? null, prices: lists.map((l) => ({ priceListId: l._id, listPrice: saved.get(l._id) ?? null })) });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  }

  async function save() {
    if (!form) return;
    setBusy(true); setErr("");
    const payload = { pn: form.pn, pga: form.pga, desc: form.desc, division: form.division, application: form.application, discountCode: form.discountCode, sbu: form.sbu, familyCode: form.familyCode, itemStatus: form.itemStatus, recordType: form.recordType, hsn: form.hsn, partnerDiscountPct: form.partnerDiscountPct, prices: form.prices };
    try {
      await api(form._id ? `/api/parts/${form._id}` : "/api/parts", { method: form._id ? "PUT" : "POST", json: payload });
      setMsg({ ok: true, t: `${form._id ? "Saved" : "Added"} part ${form.pn.trim().toUpperCase()}${form.pga.trim() ? ` / ${form.pga.trim()}` : ""}.` });
      setForm(null); setTick((n) => n + 1);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  async function del(row: Row) {
    if (!confirm(`Delete part ${row.pn}${row.pga ? ` / ${row.pga}` : ""}?\n\nIts list prices and remembered HSN are removed. Quotations already saved keep the lines they captured.`)) return;
    try { await api(`/api/parts/${row._id}`, { method: "DELETE" }); setMsg({ ok: true, t: `Deleted part ${row.pn}.` }); setTick((n) => n + 1); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  }

  return (
    <>
      <PageHeader title="Parts master" subtitle="Graco part numbers used while quoting – part details, HSN and list prices">
        <button className="btn-primary" onClick={() => { setErr(""); setMsg(null); setForm(blank()); }}><Plus className="h-4 w-4" />Add part</button>
      </PageHeader>
      <div className="card mb-4 p-4 text-sm text-slate-600">
        Parts usually arrive with the yearly <b>Pricing → Price lists</b> import. Add one here when a part is missing, or correct its description, HSN, discount code or list price. A quotation copies the part it uses, so edits never change a quotation that was already saved.
      </div>
      {msg && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Part number or description…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-40" value={division} onChange={(e) => setDivision(e.target.value)}><option value="">All divisions</option>{meta.divisions.map((d) => <option key={d}>{d}</option>)}</select>
          <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{meta.statuses.map((d) => <option key={d}>{d}</option>)}</select>
        </div>
        <div className="table-scroll">
          <table className="w-full">
            <thead><tr><th className="th">Part no.</th><th className="th">Description</th><th className="th w-28">HSN</th><th className="th w-32">Status</th><th className="th w-24 text-right">Disc. %</th>{latest && <th className="th w-32 text-right">{latest.year} list ₹</th>}<th className="th w-24" /></tr></thead>
            <tbody>
              {loading && !data && <tr><td colSpan={latest ? 7 : 6} className="td py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
              {data?.items.length === 0 && <tr><td colSpan={latest ? 7 : 6} className="td py-10 text-center text-slate-400">No parts found.{q || division || status ? " Try a different search." : " Add one, or import a price list."}</td></tr>}
              {data?.items.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50">
                  <td className="td font-mono text-xs font-medium text-slate-900">{p.pn}{p.pga && <span className="block text-[11px] font-normal text-slate-400">{p.pga}</span>}</td>
                  <td className="td max-w-xs">{p.desc}<div className="text-[11px] text-slate-400">{[p.division, p.discountCode].filter(Boolean).join(" · ")}</div></td>
                  <td className="td font-mono text-xs">{p.hsn || <span className="text-slate-400">—</span>}</td>
                  <td className="td text-xs">{p.itemStatus || "—"}</td>
                  <td className="td text-right tabular-nums">{p.costDiscountPct !== null ? `${p.costDiscountPct}%` : <span className="text-slate-400">—</span>}</td>
                  {latest && <td className="td text-right tabular-nums">{inr(p.prices[latest._id])}</td>}
                  <td className="td text-right">
                    <button className="p-1.5 text-slate-500 hover:text-brand-600" title="Edit part" disabled={busy} onClick={() => edit(p)}><Pencil className="h-4 w-4" /></button>
                    <button className="p-1.5 text-slate-500 hover:text-red-600" title="Delete part" onClick={() => del(p)}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <Pager page={page} pages={data.pages} total={data.total} set={setPage} />}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => setForm(null)}>
          <div className="card max-h-[min(92dvh,46rem)] w-full max-w-2xl overflow-y-auto rounded-b-none p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{form._id ? `Edit ${form.pn}${form.pga ? ` / ${form.pga}` : ""}` : "Add part"}</h2><button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-500" /></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label">Part number</label><input className="input font-mono" value={form.pn} disabled={!!form._id} onChange={(e) => setForm({ ...form, pn: e.target.value.toUpperCase() })} /></div>
                <div><label className="label">PGA</label><input className="input font-mono" value={form.pga} disabled={!!form._id} onChange={(e) => setForm({ ...form, pga: e.target.value })} /></div>
              </div>
              <div><label className="label">Description</label><input className="input" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label">Division</label><input className="input" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} /></div>
                <div><label className="label">Application</label><input className="input" value={form.application} onChange={(e) => setForm({ ...form, application: e.target.value })} /></div>
                <div><label className="label">Discount code</label><input className="input" value={form.discountCode} onChange={(e) => setForm({ ...form, discountCode: e.target.value })} /></div>
                <div><label className="label">SBU</label><input className="input" value={form.sbu} onChange={(e) => setForm({ ...form, sbu: e.target.value })} /></div>
                <div><label className="label">Family code</label><input className="input" value={form.familyCode} onChange={(e) => setForm({ ...form, familyCode: e.target.value })} /></div>
                <div><label className="label">Item status</label><input className="input" value={form.itemStatus} onChange={(e) => setForm({ ...form, itemStatus: e.target.value })} /></div>
                <div><label className="label">Record type</label><input className="input" value={form.recordType} onChange={(e) => setForm({ ...form, recordType: e.target.value })} /></div>
                <div><label className="label">HSN</label><input className="input font-mono" maxLength={8} placeholder="4 to 8 digits" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value.replace(/\D/g, "") })} /></div>
                <div><label className="label">Distributor discount %</label><input className="input" type="number" min={0} max={100} placeholder="from discount rules" value={form.partnerDiscountPct ?? ""} onChange={(e) => setForm({ ...form, partnerDiscountPct: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              </div>
              <div>
                <label className="label">List price per price list</label>
                <p className="mb-2 text-xs text-slate-500">Leave blank when the part is not sold in that year.</p>
                <div className="space-y-2">
                  {form.prices.length === 0 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">No price lists imported yet – add prices under <b>Pricing → Price lists</b>.</p>}
                  {form.prices.map((row, i) => {
                    const l = lists.find((x) => x._id === row.priceListId);
                    return (
                      <div key={row.priceListId} className="flex items-center gap-3">
                        <span className="w-40 text-sm text-slate-600">{l ? `${l.year} · ${dmy(l.effectiveFrom)}` : "Unknown list"}</span>
                        <input className="input flex-1 text-right tabular-nums" type="number" min={0} step="0.01" placeholder="—" value={row.listPrice ?? ""}
                          onChange={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); setForm({ ...form, prices: form.prices.map((p, j) => (j === i ? { ...p, listPrice: v } : p)) }); }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              {form._id && <p className="text-xs text-slate-500">Part number and PGA cannot be changed because they identify the part – add a new part instead.</p>}
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
              <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" disabled={busy || !form.pn.trim()} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
