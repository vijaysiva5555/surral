"use client";
import { useEffect, useState } from "react";
import { X, Trash2, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { dmy, inr } from "@/lib/format";

type A = { _id: string; pn: string; discountPct?: number; fixedPrice?: number; validFrom?: string; validTo?: string; note?: string };
export default function AgreementsModal({ customer, canEdit, onClose }: { customer: { _id: string; name: string; standardDiscountPct?: number }; canEdit: boolean; onClose: () => void }) {
  const [items, setItems] = useState<A[]>([]); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ pn: "", mode: "discount" as "discount" | "price", value: "", validFrom: "", validTo: "", note: "" });
  const load = () => api(`/api/customers/${customer._id}/agreements`).then((r) => setItems(r.items));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    setBusy(true); setErr("");
    try {
      await api(`/api/customers/${customer._id}/agreements`, { json: { pn: f.pn, discountPct: f.mode === "discount" && f.value !== "" ? Number(f.value) : null, fixedPrice: f.mode === "price" && f.value !== "" ? Number(f.value) : null, validFrom: f.validFrom || null, validTo: f.validTo || null, note: f.note } });
      setF({ ...f, pn: "", value: "", note: "" }); load();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h2 className="text-lg font-semibold">Price agreements</h2><p className="text-sm text-slate-500">M/s. {customer.name}{customer.standardDiscountPct ? ` · standard discount ${customer.standardDiscountPct}%` : ""}</p></div><button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button></div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">When a Graco part is added to this customer’s quotation, its own agreement is used first, then the “*” (all parts) agreement, then the customer’s standard discount. A <b>fixed price</b> replaces the list price; a <b>discount %</b> is taken off it.</p>
          <table className="w-full"><thead><tr><th className="th">Part no.</th><th className="th">Agreement</th><th className="th">Valid</th><th className="th">Note</th><th className="th w-10" /></tr></thead>
            <tbody>{items.length === 0 && <tr><td colSpan={5} className="td py-6 text-center text-slate-400">No agreements yet.</td></tr>}
              {items.map((a) => (<tr key={a._id}><td className="td font-mono text-xs font-medium">{a.pn === "*" ? "* all parts" : a.pn}</td><td className="td">{a.fixedPrice != null ? `₹${inr(a.fixedPrice)} fixed` : `${a.discountPct}% off`}</td>
                <td className="td text-xs">{a.validFrom ? dmy(a.validFrom) : "any"} → {a.validTo ? dmy(a.validTo) : "open"}</td><td className="td text-xs text-slate-500">{a.note}</td>
                <td className="td">{canEdit && <button onClick={async () => { await api(`/api/agreements/${a._id}`, { method: "DELETE" }); load(); }}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>}</td></tr>))}</tbody></table>
          {canEdit && (
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 text-sm font-semibold">Add agreement</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <div><label className="label">Part no. (or *)</label><input className="input font-mono" value={f.pn} onChange={(e) => setF({ ...f, pn: e.target.value })} placeholder="233776 or *" /></div>
                <div><label className="label">Type</label><select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as "discount" | "price" })}><option value="discount">Discount %</option><option value="price">Fixed price ₹</option></select></div>
                <div><label className="label">{f.mode === "discount" ? "Discount %" : "Unit price ₹"}</label><input className="input" type="number" min={0} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></div>
                <div><label className="label">Note</label><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Annual contract" /></div>
                <div><label className="label">Valid from</label><input className="input" type="date" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} /></div>
                <div><label className="label">Valid to</label><input className="input" type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} /></div>
              </div>
              {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
              <div className="mt-3 flex justify-end"><button className="btn-primary" disabled={busy} onClick={add}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Add agreement</button></div>
            </div>)}
        </div>
      </div>
    </div>
  );
}
