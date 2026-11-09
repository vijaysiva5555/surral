"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Star } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";

type T = { _id?: string; name: string; isDefault: boolean; terms: { label: string; value: string }[] };
export default function TermsClient() {
  const [items, setItems] = useState<T[]>([]); const [cur, setCur] = useState<T | null>(null); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  const load = async (selectId?: string) => { const r = await api("/api/terms"); setItems(r.items); setCur((c) => structuredClone(r.items.find((x: T) => x._id === (selectId ?? c?._id)) ?? r.items[0] ?? null)); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (!cur) return; setBusy(true); setMsg(null);
    try { const r = await api(cur._id ? `/api/terms/${cur._id}` : "/api/terms", { method: cur._id ? "PUT" : "POST", json: cur }); await load(r.item._id); setMsg({ ok: true, t: "Template saved." }); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  }
  async function del() { if (cur?._id && confirm(`Delete “${cur.name}”?`)) { try { await api(`/api/terms/${cur._id}`, { method: "DELETE" }); setCur(null); await load(); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } } }
  const setRow = (i: number, p: Partial<{ label: string; value: string }>) => setCur({ ...cur!, terms: cur!.terms.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <>
      <PageHeader title="Terms & conditions templates" subtitle="Pick a template on any quotation. Write {customer} where the customer’s short name should appear.">
        <button className="btn-primary" onClick={() => { setMsg(null); setCur({ name: "", isDefault: false, terms: [{ label: "Payment Terms", value: "" }] }); }}><Plus className="h-4 w-4" />New template</button>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <div className="card h-fit overflow-hidden">{items.map((t) => (
          <button key={t._id} onClick={() => { setMsg(null); setCur(structuredClone(t)); }} className={`flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 ${cur?._id === t._id ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-slate-50"}`}>{t.name}{t.isDefault && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}</button>))}</div>
        {cur && (
          <section className="card space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div><label className="label">Template name</label><input className="input" value={cur.name} onChange={(e) => setCur({ ...cur, name: e.target.value })} /></div>
              <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={cur.isDefault} onChange={(e) => setCur({ ...cur, isDefault: e.target.checked })} />Default for new quotations</label></div>
            <div className="space-y-2">{cur.terms.map((t, i) => (
              <div key={i} className="flex gap-2"><span className="w-5 pt-2 text-right text-xs text-slate-400">{i + 1}.</span>
                <input className="input !w-40" placeholder="Label" value={t.label} onChange={(e) => setRow(i, { label: e.target.value })} /><input className="input" placeholder="Value" value={t.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                <button onClick={() => setCur({ ...cur, terms: cur.terms.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button></div>))}
              <button className="text-sm font-medium text-brand-600" onClick={() => setCur({ ...cur, terms: [...cur.terms, { label: "", value: "" }] })}>+ Add term</button></div>
            {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</p>}
            <div className="flex justify-between"><button className="text-sm text-red-600" onClick={del} disabled={!cur._id}>Delete template</button><button className="btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save template</button></div>
          </section>)}
      </div>
    </>
  );
}
