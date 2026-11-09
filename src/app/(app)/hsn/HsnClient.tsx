"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Upload, Search, Pencil, Trash2, X, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";

type H = { _id?: string; code: string; description: string; gstRate: number; active: boolean };
export default function HsnClient({ admin }: { admin: boolean }) {
  const [items, setItems] = useState<H[]>([]); const [q, setQ] = useState(""); const [form, setForm] = useState<H | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const file = useRef<HTMLInputElement>(null);
  const load = useCallback(() => api(`/api/hsn?q=${encodeURIComponent(q)}`).then((r) => setItems(r.items)), [q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function save() {
    if (!form) return; setBusy(true); setErr("");
    try { await api(form._id ? `/api/hsn/${form._id}` : "/api/hsn", { method: form._id ? "PUT" : "POST", json: form }); setForm(null); load(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function del(h: H) { if (confirm(`Delete HSN ${h.code}?`)) { await api(`/api/hsn/${h._id}`, { method: "DELETE" }); load(); } }
  async function imp(f: File) {
    const fd = new FormData(); fd.append("file", f);
    try { const r = await api("/api/hsn/import", { method: "POST", body: fd }); setMsg({ ok: true, t: `Imported: ${r.added} new, ${r.updated} updated, ${r.skipped} skipped.` }); load(); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    if (file.current) file.current.value = "";
  }
  return (
    <>
      <PageHeader title="HSN codes" subtitle="Suggested while typing HSN on a quotation. The HSN used for a Graco part is remembered for next time.">
        {admin && <><input ref={file} type="file" accept=".xlsx" hidden onChange={(e) => e.target.files?.[0] && imp(e.target.files[0])} /><button className="btn-ghost" onClick={() => file.current?.click()}><Upload className="h-4 w-4" />Import Excel</button>
          <button className="btn-primary" onClick={() => { setErr(""); setForm({ code: "", description: "", gstRate: 18, active: true }); }}><Plus className="h-4 w-4" />Add HSN</button></>}
      </PageHeader>
      {msg && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}
      <div className="card overflow-hidden">
        <div className="relative border-b border-slate-200 p-4"><Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search HSN or description…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <table className="w-full"><thead><tr><th className="th w-36">HSN</th><th className="th">Description</th><th className="th w-28 text-right">GST %</th><th className="th w-24" /></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={4} className="td py-10 text-center text-slate-400">No HSN codes yet.{admin && " Add one, or import an Excel with columns HSN, Description, GST %."}</td></tr>}
            {items.map((h) => (<tr key={h._id} className="hover:bg-slate-50"><td className="td font-mono font-medium">{h.code}</td><td className="td">{h.description}</td><td className="td text-right">{h.gstRate}%</td>
              <td className="td text-right">{admin && <><button className="p-1.5 text-slate-500 hover:text-brand-600" onClick={() => { setErr(""); setForm({ ...h }); }}><Pencil className="h-4 w-4" /></button><button className="p-1.5 text-slate-500 hover:text-red-600" onClick={() => del(h)}><Trash2 className="h-4 w-4" /></button></>}</td></tr>))}
          </tbody></table>
      </div>
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setForm(null)}>
          <div className="card w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{form._id ? "Edit HSN" : "Add HSN"}</h2><button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-500" /></button></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="label">HSN code</label><input className="input font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, "") })} maxLength={8} /></div>
              <div><label className="label">GST %</label><input className="input" type="number" min={0} max={28} value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })} /></div></div>
            <div><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
            <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></div>
          </div>
        </div>)}
    </>
  );
}
