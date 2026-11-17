"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import StockPartInput, { type StockPart } from "@/components/StockPartInput";
import { api } from "@/lib/client";
import { dayLabel, qtyText, r2, todayIST } from "@/lib/stockCalc";
import { DOC_UI } from "./StockDocsClient";

/** auto = the description the part number filled in; while the box still shows it, the description follows the part number */
type Line = { key: number; pn: string; desc: string; qty: string; remarks: string; auto?: string };
/** what the ledger knows about a part: undefined = not looked up yet, null = not a stock item */
type StockInfo = Record<string, { balance: number; location: string } | null>;
let seq = 1;
const blank = (): Line => ({ key: seq++, pn: "", desc: "", qty: "", remarks: "" });
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

/** Customer name box: suggestions from the Customers master, but any name may be typed (it is not added to the master). */
function PartyInput({ type, value, onChange, onPick, disabled }: { type: "in" | "out"; value: string; onChange: (v: string) => void; onPick: (c: { _id: string; name: string }) => void; disabled?: boolean }) {
  const [res, setRes] = useState<{ _id: string; name: string; state?: string }[]>([]);
  const [open, setOpen] = useState(false);
  const typed = useRef(false);
  useEffect(() => {
    if (type !== "out" || !typed.current || value.trim().length < 2) { setRes([]); return; }
    let stale = false;
    const t = setTimeout(() => api(`/api/customers?q=${encodeURIComponent(value.trim())}`).then((r) => { if (!stale) { setRes(r.items.slice(0, 8)); setOpen(true); } }).catch(() => {}), 250);
    return () => { stale = true; clearTimeout(t); };
  }, [value, type]);
  return (
    <div className="relative">
      <input className="input" disabled={disabled} autoComplete="off" placeholder={type === "out" ? "Type the customer name…" : "e.g. Graco"} value={value}
        onChange={(e) => { typed.current = true; onChange(e.target.value); }} onBlur={() => setTimeout(() => setOpen(false), 150)} onFocus={() => res.length > 0 && setOpen(true)} />
      {open && res.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {res.map((c) => (
            <button key={c._id} type="button" className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-brand-50"
              onMouseDown={(e) => { e.preventDefault(); typed.current = false; setOpen(false); onPick(c); }}>
              <span className="truncate font-medium text-slate-800">{c.name}</span>{c.state && <span className="shrink-0 text-xs text-slate-400">{c.state}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StockDocEditor({ type, id, canEdit }: { type: "in" | "out"; id?: string; canEdit: boolean }) {
  const ui = DOC_UI[type];
  const router = useRouter();
  const [no, setNo] = useState(""); const [date, setDate] = useState(todayIST()); const [party, setParty] = useState(""); const [customerId, setCustomerId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState(""); const [lines, setLines] = useState<Line[]>([]);
  useEffect(() => { if (!id) setLines([blank(), blank(), blank()]); }, [id]);   // row keys are made in the browser only, so server and client markup agree
  const [stock, setStock] = useState<StockInfo>({});
  const [original, setOriginal] = useState<Record<string, number>>({});   // quantities this document already took out / put in, per part
  const [meta, setMeta] = useState<{ createdByName?: string; updatedByName?: string; updatedAt?: string; imported?: boolean } | null>(null);
  const [loading, setLoading] = useState(!!id); const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    api(`/api/stock/docs/${id}`).then((r) => {
      const d = r.item;
      setNo(d.no ?? ""); setDate(d.date); setParty(d.party ?? ""); setCustomerId(d.customerId ?? null); setRemarks(d.remarks ?? "");
      setLines([...(d.lines ?? []).map((l: { pn: string; desc: string; qty: number; remarks?: string }) => ({ key: seq++, pn: l.pn ?? "", desc: l.desc ?? "", qty: qtyText(l.qty), remarks: l.remarks ?? "" })), ...(canEdit ? [blank()] : [])]);
      const info: StockInfo = {}, own: Record<string, number> = {};
      for (const l of d.lines ?? []) if (l.pn) { info[l.pn] = r.stock[l.pn] ?? null; if (r.stock[l.pn]) own[l.pn] = r2((own[l.pn] ?? 0) + l.qty); }
      setStock(info); setOriginal(own); setMeta({ createdByName: d.createdByName, updatedByName: d.updatedByName, updatedAt: d.updatedAt, imported: d.imported });
    }).catch((e) => setMsg({ ok: false, text: (e as Error).message })).finally(() => setLoading(false));
  }, [id, canEdit]);

  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  /** the part number changed by typing: a description that came from the previous number goes with it */
  const typePn = (key: number, pn: string) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, pn, ...(l.auto && l.desc === l.auto ? { desc: "", auto: "" } : {}) } : l)));
  /** the part is known (typed in full, or chosen): its description and stock fill in; the cursor stays where it is */
  const match = (key: number, p: StockPart, setPn = false) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...(setPn ? { pn: p.pn } : {}), ...(p.desc ? { desc: p.desc, auto: p.desc } : {}) } : l)));
    setStock((s) => ({ ...s, [p.pn]: p.inLedger ? { balance: p.balance ?? 0, location: p.location } : null }));
  };
  /** chosen from the list: fill in and go on to the quantity */
  const pick = (key: number, p: StockPart) => { match(key, p, true); setTimeout(() => document.querySelector<HTMLInputElement>(`[data-qty="${key}"]`)?.focus(), 0); };
  const filled = lines.filter((l) => l.pn.trim() || l.desc.trim() || l.qty.trim());
  const total = r2(filled.reduce((s, l) => s + (Number(l.qty) || 0), 0));

  /** outward only: how much of each part this form asks for, against what is in stock (plus what this invoice already holds) */
  const short = useMemo(() => {
    if (type !== "out") return {} as Record<string, number>;
    const want: Record<string, number> = {};
    for (const l of lines) { const pn = norm(l.pn); if (pn && stock[pn]) want[pn] = r2((want[pn] ?? 0) + (Number(l.qty) || 0)); }
    return Object.fromEntries(Object.entries(want).filter(([pn, q]) => q > r2((stock[pn]?.balance ?? 0) + (original[pn] ?? 0))).map(([pn]) => [pn, r2((stock[pn]?.balance ?? 0) + (original[pn] ?? 0))]));
  }, [lines, stock, original, type]);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const body = { type, no, date, party, customerId, remarks, lines: filled.map((l) => ({ pn: l.pn, desc: l.desc, qty: l.qty === "" ? 0 : Number(l.qty), remarks: l.remarks })) };
      if (id) { await api(`/api/stock/docs/${id}`, { method: "PUT", json: body }); setMsg({ ok: true, text: "Saved. The stock ledger is updated." }); router.refresh(); const r = await api(`/api/stock/docs/${id}`); setMeta((m) => ({ ...m, updatedByName: r.item.updatedByName, updatedAt: r.item.updatedAt })); const own: Record<string, number> = {}, info: StockInfo = { ...stock }; for (const l of r.item.lines) if (l.pn) { info[l.pn] = r.stock[l.pn] ?? null; if (r.stock[l.pn]) own[l.pn] = r2((own[l.pn] ?? 0) + l.qty); } setStock(info); setOriginal(own); }
      else { const r = await api("/api/stock/docs", { json: body }); router.push(`${ui.path}/${r.item._id}`); return; }
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  }
  async function remove() {
    if (!id || !confirm(`Delete this ${ui.one}?\n\n${type === "out" ? "Its quantities go back into stock." : "Its quantities are taken out of stock again."} This cannot be undone.`)) return;
    setBusy(true);
    try { await api(`/api/stock/docs/${id}`, { method: "DELETE" }); router.push(ui.path); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); setBusy(false); }
  }

  if (loading) return <div className="py-20 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  const ro = !canEdit;
  return (
    <>
      <div className="page-toolbar">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={ui.path} className="btn-ghost !px-2.5" aria-label={`Back to ${ui.title}`}><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">{id ? `${ui.title} · ${no || "(no number)"}` : `New ${ui.one}`}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{ro ? "Read only" : type === "out" ? "Saving reduces the stock ledger on the invoice date" : "Saving adds to the stock ledger on the invoice date"}{meta?.imported && " · loaded from Excel"}{meta?.updatedByName && ` · last saved by ${meta.updatedByName}`}</p>
          </div>
        </div>
        {!ro && (
          <div className="page-toolbar-actions">
            {id && <button className="btn-ghost !text-red-600" disabled={busy} onClick={remove}><Trash2 className="h-4 w-4" />Delete</button>}
            <button className="btn-primary" disabled={busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>
          </div>
        )}
      </div>

      {msg && <div className={`mb-4 flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}><X className="h-4 w-4" /></button></div>}

      <div className="card mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label">Invoice no.</label><input className="input" disabled={ro} value={no} onChange={(e) => setNo(e.target.value)} placeholder={type === "out" ? "e.g. 1316" : "e.g. GRACO/26-27/3900"} /></div>
          <div><label className="label">Invoice date</label><input type="date" className="input" disabled={ro} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="label">{type === "out" ? "Customer name" : "Supplier"}</label>
            <PartyInput type={type} disabled={ro} value={party} onChange={(v) => { setParty(v); setCustomerId(null); }} onPick={(c) => { setParty(c.name); setCustomerId(c._id); }} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4"><label className="label">Remarks</label><input className="input" disabled={ro} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div><div className="font-semibold text-slate-900">Items</div><div className="text-xs text-slate-500">{filled.length} item{filled.length === 1 ? "" : "s"} · total qty {qtyText(total)}</div></div>
          {!ro && <button className="btn-ghost" onClick={() => setLines((l) => [...l, blank()])}><Plus className="h-4 w-4" />Add row</button>}
        </div>
        <div className="xl-sheet !rounded-none !border-0">
          <table className="table-fixed md:min-w-[38rem]">
            <thead><tr><th className="xl-th hidden sm:table-cell w-10">S.No</th><th className="xl-th w-28 md:w-36 xl:w-44">Part no.</th><th className="xl-th">Item Description</th><th className="xl-th w-16 md:w-20 xl:w-28">Qty</th>{type === "in" && <th className="xl-th hidden lg:table-cell w-40 xl:w-48">Remarks</th>}<th className="xl-th hidden md:table-cell w-40 xl:w-44">Stock</th>{!ro && <th className="xl-th w-9" />}</tr></thead>
            <tbody>
              {lines.map((l, i) => {
                const pn = norm(l.pn), info = pn ? stock[pn] : undefined, limit = short[pn];
                const note = !pn ? (l.desc.trim() ? <span className="text-slate-400">No part no. – stock not changed</span> : null)
                  : info === undefined ? null
                  : info === null ? <span className="text-slate-500">{type === "out" ? "Not a stock item – stock not changed" : "New – will be added to the ledger"}</span>
                  : limit != null ? <span className="inline-flex items-center gap-1 font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" />Only {qtyText(limit)} in stock</span>
                  : <span className={info.balance <= 0 ? "font-semibold text-red-600" : info.balance <= 3 ? "font-semibold text-amber-600" : "text-slate-600"}>{qtyText(info.balance)} in stock{info.location && <span className="ml-1 font-normal text-slate-400">· {info.location}</span>}</span>;
                return (
                  <tr key={l.key}>
                    <td className="xl-sn hidden sm:table-cell">{i + 1}</td>
                    <td className="border border-slate-200 p-0">{ro ? <div className="px-2 py-1.5 font-mono text-xs font-semibold">{l.pn}</div> : <StockPartInput value={l.pn} onChange={(v) => typePn(l.key, v)} onPick={(p) => pick(l.key, p)} onMatch={(p) => match(l.key, p)} />}</td>
                    <td className="border border-slate-200 p-0"><input className="xl-inp" disabled={ro} value={l.desc} onChange={(e) => set(l.key, { desc: e.target.value })} />{note && <div className="px-2 pb-1.5 text-[11px] md:hidden">{note}</div>}</td>
                    <td className={`border border-slate-200 p-0 ${limit != null ? "bg-red-50" : ""}`}><input data-qty={l.key} className="xl-inp text-right tabular-nums" disabled={ro} inputMode="decimal" value={l.qty}
                      onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && set(l.key, { qty: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter" && i === lines.length - 1) { e.preventDefault(); setLines((ls) => [...ls, blank()]); } }} /></td>
                    {type === "in" && <td className="border border-slate-200 p-0 hidden lg:table-cell"><input className="xl-inp" disabled={ro} value={l.remarks} onChange={(e) => set(l.key, { remarks: e.target.value })} /></td>}
                    <td className="xl-ro hidden md:table-cell text-xs">{note}</td>
                    {!ro && <td className="border border-slate-200 text-center"><button title="Remove row" className="p-1.5 text-slate-400 hover:text-red-600" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blank()]))}><X className="h-4 w-4" /></button></td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr className="font-semibold"><td className="xl-sn hidden sm:table-cell" /><td className="xl-ro" colSpan={2}>Total</td><td className="xl-ro text-right">{qtyText(total)}</td>{type === "in" && <td className="xl-ro hidden lg:table-cell" />}<td className="xl-ro hidden md:table-cell" />{!ro && <td className="xl-ro" />}</tr></tfoot>
          </table>
        </div>
        {!ro && <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">Type a part number: its description fills in from the Parts master (or the stock ledger) as soon as the number is complete, or pick it from the list. {type === "out" ? `Stock cannot go below zero: an item is refused when it asks for more than is in stock on ${dayLabel(date)}.` : "A part that is not on the ledger yet is added to it automatically."}</p>}
      </div>
    </>
  );
}
