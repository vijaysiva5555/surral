"use client";
import { useCan } from "@/components/PermsContext";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search, Upload, Pencil, Trash2, X, Loader2, BadgePercent, Download, FileText } from "lucide-react";
import AgreementsModal from "./AgreementsModal";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";
import { stateFromGstin, cleanGstin } from "@/lib/india";
import { type Role } from "@/lib/roles";
import { useDebouncedLoad } from "@/lib/useDebouncedLoad";

type Contact = { name: string; phone: string; email: string; designation: string };
type Customer = { _id?: string; name: string; addressLines: string[]; pincode: string; gstin: string; state?: string; stateCode?: string; contacts: Contact[]; standardDiscountPct?: number; active: boolean; quoteCount?: number };
type StateOption = { code: string; name: string; count: number };
/** full address on one line; the pincode is added only when the address does not already contain it ("631 604" counts as 631604) */
const fullAddress = (c: Customer) => { const a = c.addressLines.map((l) => l.trim()).filter(Boolean).join(", "); return c.pincode && !a.replace(/\s+/g, "").includes(c.pincode) ? `${a}${a ? " – " : ""}${c.pincode}` : a; };
const blank = (): Customer => ({ name: "", addressLines: [], pincode: "", gstin: "", contacts: [{ name: "", phone: "", email: "", designation: "" }], standardDiscountPct: 0, active: true });

export default function CustomersClient({ role }: { role: Role }) {
  const canEdit = useCan()("customers", "edit");   // Administration → Page access; deleting stays with admins
  const [items, setItems] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [state, setState] = useState("");                                    // GST state code, "none" (no GST) or "" for all
  const [states, setStates] = useState<StateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Customer | null>(null);
  const [agr, setAgr] = useState<Customer | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const query = `q=${encodeURIComponent(q)}&state=${encodeURIComponent(state)}`;   // shared by the list and the Excel export
  const filtered = !!(q.trim() || state);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api(`/api/customers?${query}`); setItems(r.items); setStates(r.states ?? []); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setLoading(false);
  }, [query]);
  useDebouncedLoad(load, [load]);

  async function importFile(f: File) {
    const fd = new FormData(); fd.append("file", f);
    try {
      const r = await api("/api/customers/import", { method: "POST", body: fd });
      setMsg({ ok: true, text: `Imported ${r.total} customers (${r.created} new, ${r.updated} updated).` });
      load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(c: Customer) {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    try { await api(`/api/customers/${c._id}`, { method: "DELETE" }); load(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }

  return (
    <>
      <PageHeader title="Customers" subtitle={`${items.length} customer${items.length === 1 ? "" : "s"}`}>
        <a className="btn-ghost" href={`/api/customers/export?${query}`} title={filtered ? "Exports the customers shown below" : "Exports all customers"}><Download className="h-4 w-4" />Export Excel</a>
        {canEdit && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Import Excel</button>
            <button className="btn-primary" onClick={() => setForm(blank())}><Plus className="h-4 w-4" />Add customer</button>
          </>
        )}
      </PageHeader>

      {msg && <div className={`mb-4 flex items-center justify-between rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}<button onClick={() => setMsg(null)}><X className="h-4 w-4" /></button></div>}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search by company name, GST number, address or pincode…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input sm:w-64" aria-label="Filter by state" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All states</option>
            {states.map((s) => <option key={s.code} value={s.code}>{s.code === "none" ? s.name : `${s.code} · ${s.name}`} ({s.count})</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Company</th><th className="th hidden xl:table-cell">Address</th><th className="th hidden md:table-cell">GST No.</th><th className="th hidden md:table-cell">State</th><th className="th hidden xl:table-cell">Contact</th><th className="th hidden sm:table-cell w-28 text-right">Quotations</th><th className="th sm:w-28" /></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="td text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-slate-400">No customers found{filtered ? " for this search / state" : ""}.</td></tr>}
              {items.map((c) => (
                <tr key={c._id} className="align-top hover:bg-slate-50">
                  <td className="td"><div className="font-medium text-slate-900">M/s. {c.name}</div>
                    <div className="mt-0.5 space-y-0.5 text-xs text-slate-500 xl:hidden">
                      {fullAddress(c) && <div>{fullAddress(c)}</div>}
                      {(c.gstin || c.state) && <div className="md:hidden">{[c.gstin, c.state].filter(Boolean).join(" · ")}</div>}
                      {c.contacts[0]?.name && <div>{c.contacts[0].name}{c.contacts[0].phone && ` · ${c.contacts[0].phone}`}</div>}
                    </div></td>
                  <td className="td hidden max-w-xs text-sm text-slate-600 xl:table-cell">{fullAddress(c) || "—"}</td>
                  <td className="td hidden md:table-cell font-mono text-xs">{c.gstin || "—"}</td>
                  <td className="td hidden md:table-cell">{c.state ? <span className="badge bg-brand-50 text-brand-700">{c.stateCode} · {c.state}</span> : "—"}</td>
                  <td className="td hidden xl:table-cell">{(c.standardDiscountPct ?? 0) > 0 && <span className="badge mb-1 bg-purple-50 text-purple-700">{c.standardDiscountPct}% std discount</span>}<div>{c.contacts[0]?.name}</div><div className="text-xs text-slate-500">{c.contacts[0]?.phone}{c.contacts.length > 1 && ` +${c.contacts.length - 1} more`}</div></td>
                  <td className="td hidden sm:table-cell text-right">
                    <span className="mr-2 inline-block min-w-[1.25rem] text-sm font-medium tabular-nums text-slate-700">{c.quoteCount ?? 0}</span>
                    {c._id && (
                      <Link
                        title={`${c.quoteCount ?? 0} quotation${(c.quoteCount ?? 0) === 1 ? "" : "s"}`}
                        href={`/spare/quotations?customerId=${c._id}&customer=${encodeURIComponent(c.name)}`}
                        className="inline-block p-1.5 text-slate-500 hover:text-brand-600"
                      >
                        <FileText className="h-4 w-4" />
                      </Link>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-right">
                    <button title="Price agreements" className="p-1.5 text-slate-500 hover:text-brand-600" onClick={() => setAgr(c)}><BadgePercent className="h-4 w-4" /></button>
                    {canEdit && <button title="Edit" className="p-1.5 text-slate-500 hover:text-brand-600" onClick={() => setForm(structuredClone(c))}><Pencil className="h-4 w-4" /></button>}
                    {role === "admin" && <button title="Delete" className="p-1.5 text-slate-500 hover:text-red-600" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {agr && <AgreementsModal customer={agr as Customer & { _id: string }} canEdit={canEdit} onClose={() => setAgr(null)} />}
      {form && <CustomerDrawer initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </>
  );
}

function CustomerDrawer({ initial, onClose, onSaved }: { initial: Customer; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState<Customer>(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const st = stateFromGstin(cleanGstin(c.gstin));
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((p) => ({ ...p, [k]: v }));
  const setContact = (i: number, k: keyof Contact, v: string) => set("contacts", c.contacts.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function save() {
    setBusy(true); setErr("");
    try {
      const body = { name: c.name, addressLines: c.addressLines, pincode: c.pincode, gstin: c.gstin, contacts: c.contacts.filter((x) => x.name || x.phone || x.email), standardDiscountPct: c.standardDiscountPct ?? 0, active: c.active };
      await api(c._id ? `/api/customers/${c._id}` : "/api/customers", { method: c._id ? "PUT" : "POST", json: body });
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold">{c._id ? "Edit customer" : "New customer"}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div><label className="label">Company name *</label><input className="input" value={c.name} onChange={(e) => set("name", e.target.value)} placeholder="Without “M/s.” — it is added on the quotation" /></div>
          <div><label className="label">Address (one line per row)</label><textarea className="input" rows={4} value={c.addressLines.join("\n")} onChange={(e) => set("addressLines", e.target.value.split("\n"))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Pincode</label><input className="input" maxLength={6} value={c.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} /></div>
            <div><label className="label">GST number</label><input className="input font-mono uppercase" maxLength={15} value={c.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} /></div>
          </div>
          <p className="-mt-3 text-xs text-slate-500">{st.state ? `State detected: ${st.stateCode} · ${st.state}` : "State is detected automatically from the GST number."}</p>

          <div>
            <div className="mb-2 flex items-center justify-between"><span className="label !mb-0">Contacts</span>
              <button className="text-sm font-medium text-brand-600" onClick={() => set("contacts", [...c.contacts, { name: "", phone: "", email: "", designation: "" }])}>+ Add contact</button></div>
            <div className="space-y-3">
              {c.contacts.map((ct, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3">
                  <input className="input" placeholder="Name (e.g. Mr. Dinesh)" value={ct.name} onChange={(e) => setContact(i, "name", e.target.value)} />
                  <input className="input" placeholder="Mobile" value={ct.phone} onChange={(e) => setContact(i, "phone", e.target.value)} />
                  <input className="input" placeholder="Email" value={ct.email} onChange={(e) => setContact(i, "email", e.target.value)} />
                  <div className="flex gap-2"><input className="input" placeholder="Designation" value={ct.designation} onChange={(e) => setContact(i, "designation", e.target.value)} />
                    {c.contacts.length > 1 && <button onClick={() => set("contacts", c.contacts.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="max-w-[12rem]"><label className="label">Standard discount %</label><input className="input" type="number" min={0} max={100} step="0.5" value={c.standardDiscountPct ?? 0} onChange={(e) => set("standardDiscountPct", Number(e.target.value))} /><p className="mt-1 text-xs text-slate-400">Applied automatically to Graco parts on this customer’s quotations.</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.active} onChange={(e) => set("active", e.target.checked)} />Active customer</label>
        </div>
        <div className="border-t border-slate-200 p-4">
          {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save customer</button></div>
        </div>
      </div>
    </div>
  );
}
