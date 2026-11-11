/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, Loader2, Copy, FileSpreadsheet, ImagePlus, ClipboardPaste } from "lucide-react";
import { api } from "@/lib/client";
import { resizeImage } from "@/lib/clientImage";
import { pickList } from "@/lib/priceLists";
import { bomSummary, isBlankItem, itemLanded, itemTotalLanded, itemTotalList, itemUnitPrice, rowLetter, type BomItem } from "@/lib/bomCalc";
import { EDIT_FIELDS, parseBomPaste, type EditField } from "@/lib/bomPaste";
import { inr } from "@/lib/format";
import PartPicker from "@/components/PartPicker";
import type { QuoteCategory } from "@/lib/quoteCategory";

type Row = Record<EditField, string>;
const blankRow = (): Row => ({ make: "", description: "", qty: "1", listPrice: "", discountPct: "", landed: "", marginPct: "20" });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const n = (s: string) => { const v = Number(String(s).replace(/,/g, "")); return Number.isFinite(v) ? v : 0; };
const toItem = (r: Row): BomItem => ({ make: r.make, description: r.description, qty: n(r.qty), listPrice: n(r.listPrice), discountPct: n(r.discountPct), landed: n(r.landed), marginPct: n(r.marginPct) });
const fromItem = (i: any): Row => ({ make: i.make ?? "", description: i.description ?? "", qty: String(i.qty ?? 1), listPrice: i.listPrice ? String(i.listPrice) : "", discountPct: i.listPrice ? String(i.discountPct ?? 0) : "", landed: !i.listPrice && i.landed ? String(i.landed) : "", marginPct: String(i.marginPct ?? 20) });
/** visual column index of every editable field (S.NO=0 and the totals / unit price are calculated) */
const COL: Record<EditField, number> = { make: 1, description: 2, qty: 3, listPrice: 4, discountPct: 6, landed: 7, marginPct: 9 };
const NAV_COLS = [1, 2, 3, 4, 6, 7, 9];

export default function BomEditor({ id, category, basePath }: { id?: string; category: QuoteCategory; basePath: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!id); const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [name, setName] = useState(""); const [date, setDate] = useState(today());
  const [image, setImage] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([blankRow(), blankRow(), blankRow()]);
  const [lists, setLists] = useState<any[]>([]); const [saved, setSaved] = useState(""); const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api("/api/pricing/lists").then((r) => setLists(r.items)).catch(() => {});
    if (!id) return;
    api(`/api/bom/${id}`).then((r) => {
      const b = r.item; setName(b.name); setDate(b.date.slice(0, 10)); setImage(b.image ?? null);
      setRows([...(b.items ?? []).map(fromItem), blankRow()]); setLoading(false);
    }).catch((e) => { setMsg({ ok: false, t: e.message }); setLoading(false); });
  }, [id]);

  const listId = useMemo(() => (lists.length ? pickList(lists, date) : ""), [lists, date]);
  const items = useMemo(() => rows.map(toItem), [rows]);
  const sum = useMemo(() => bomSummary({ items }), [items]);
  const payload = useMemo(() => ({ name, date, image, items: items.filter((i) => !isBlankItem(i)) }), [name, date, image, items]);
  useEffect(() => { if (!loading && id && !saved) setSaved(JSON.stringify(payload)); }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!id && saved !== "" && JSON.stringify(payload) !== saved;

  const focusCell = (r: number, c: number) => setTimeout(() => { const el = grid.current?.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`); el?.focus(); el?.select(); }, 0);
  const setCell = (r: number, f: EditField, v: string) => setRows((rs) => rs.map((x, i) => (i === r ? { ...x, [f]: v } : x)));
  const withSpare = (rs: Row[]) => (rs.length && !isBlankItem(toItem(rs[rs.length - 1])) ? [...rs, blankRow()] : rs);

  function onKey(e: React.KeyboardEvent, r: number, c: number) {
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); if (r === rows.length - 1) setRows((rs) => [...rs, blankRow()]); focusCell(r + 1, c); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (r > 0) focusCell(r - 1, c); }
  }
  function onPaste(e: React.ClipboardEvent, r: number, f: EditField) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.trim().includes("\n")) return;           // plain single-cell paste → let the browser do it
    e.preventDefault();
    const parsed = parseBomPaste(text, f);
    if (!parsed.length) { setMsg({ ok: false, t: "Nothing to paste – no rows with a MAKE or DESCRIPTION were found." }); return; }
    const whole = f === "make" || f === "description";
    setRows((rs) => {
      const out = [...rs];
      parsed.forEach((p, i) => { const idx = r + i; const base = whole ? blankRow() : out[idx] ?? blankRow(); out[idx] = { ...base, ...(p as Partial<Row>) }; });
      return withSpare(out.map((x) => x ?? blankRow()));
    });
    setMsg({ ok: true, t: `Pasted ${parsed.length} row${parsed.length > 1 ? "s" : ""}. Check the calculated columns, then Save.` });
  }
  async function lookup(r: number) {   // typing a Graco part number in MAKE fills the description / list price / discount from the price list
    const row = rows[r], pn = row.make.trim();
    if (!listId || !/^[A-Za-z0-9-]{4,}$/.test(pn) || (row.description && row.listPrice)) return;
    try {
      const res = await api(`/api/parts?q=${encodeURIComponent(pn)}&limit=10&listIds=${listId}`);
      const p = res.items.find((x: any) => x.pn.toLowerCase() === pn.toLowerCase());
      if (!p) return;
      setRows((rs) => rs.map((x, i) => (i === r ? { ...x, description: x.description || p.desc, listPrice: x.listPrice || (p.prices[listId] != null ? String(p.prices[listId]) : ""), discountPct: x.discountPct || (p.costDiscountPct != null ? String(p.costDiscountPct) : "") } : x)));
    } catch { /* silent */ }
  }
  function addPart(p: any) {
    setRows((rs) => { const row: Row = { ...blankRow(), make: p.pn, description: p.desc, listPrice: p.price != null ? String(p.price) : "", discountPct: p.costDiscountPct != null ? String(p.costDiscountPct) : "" }; const idx = rs.findIndex((x) => isBlankItem(toItem(x))); const out = idx >= 0 ? rs.map((x, i) => (i === idx ? row : x)) : [...rs, row]; return withSpare(out); });
  }

  async function save() {
    setMsg(null); setSaving(true);
    try {
      if (id) { await api(`/api/bom/${id}`, { method: "PUT", json: payload }); setSaved(JSON.stringify(payload)); setMsg({ ok: true, t: "BOM saved." }); }
      else { const r = await api(`/api/bom?category=${category}`, { json: { ...payload, category } }); router.replace(`${basePath}/${r.item._id}`); }
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setSaving(false);
  }
  async function dup() { if (dirty && !confirm("Unsaved changes will not be copied. Continue?")) return; try { const r = await api(`/api/bom/${id}/clone`, { method: "POST" }); router.push(`${basePath}/${r.item._id}`); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } }

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-slate-400" />;
  const shown = rows.filter((r) => !isBlankItem(toItem(r))).length;
  const th = "border border-white/30 bg-brand-600 px-2 py-2 text-center text-xs font-semibold text-white";
  const ro = "border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-sm tabular-nums text-slate-700";
  const inp = "h-full w-full min-w-0 border-0 bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-brand-50 focus:ring-2 focus:ring-inset focus:ring-brand-500";
  const cell = (r: number, f: EditField, align = "text-right", extraCls = "") => (
    <td className="border border-slate-200 p-0"><input data-cell={`${r}-${COL[f]}`} className={`${inp} ${align} ${extraCls}`} value={rows[r][f]} inputMode={f === "make" || f === "description" ? "text" : "decimal"}
      onChange={(e) => setCell(r, f, e.target.value)} onKeyDown={(e) => onKey(e, r, COL[f])} onPaste={(e) => onPaste(e, r, f)} onBlur={f === "make" ? () => lookup(r) : undefined} onFocus={(e) => e.target.select()} /></td>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={basePath} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></Link>
          <div><h1 className="text-xl font-bold text-slate-900">{id ? name || "BOM" : "New BOM"}</h1><div className="text-xs text-slate-500">{dirty ? <span className="font-medium text-amber-600">Unsaved changes</span> : `${shown} item${shown === 1 ? "" : "s"}`}</div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {id && <><a className="btn-ghost" href={`/api/bom/${id}/excel`}><FileSpreadsheet className="h-4 w-4" />Excel</a><button className="btn-ghost" onClick={dup}><Copy className="h-4 w-4" />Duplicate</button></>}
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save BOM</button>
        </div>
      </div>
      {msg && <p className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</p>}

      <section className="card mb-5 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_11rem_auto]">
          <div><label className="label">BOM name *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Triton Pump Air Spray Package" /></div>
          <div><label className="label">Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="flex items-end gap-2">
            {image && <img src={image} alt="" className="h-10 rounded border border-slate-200 object-contain" />}
            <label className="btn-ghost cursor-pointer !px-3 !py-2 text-xs"><ImagePlus className="h-4 w-4" />{image ? "Replace photo" : "Add photo"}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setImage(await resizeImage(f)); } catch { setMsg({ ok: false, t: "Could not read that image." }); } } e.target.value = ""; }} /></label>
            {image && <button type="button" className="text-xs text-red-600" onClick={() => setImage(null)}>Remove</button>}
          </div>
        </div>
      </section>

      <section className="card mb-5 p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-semibold text-slate-900">Items</h2><p className="flex items-center gap-1.5 text-xs text-slate-500"><ClipboardPaste className="h-3.5 w-3.5" />Type like in Excel (Enter / ↑ ↓ to move) or copy rows from your Excel BOM sheet and paste into the <b>MAKE</b> cell. White cells are typed; grey cells are calculated.</p></div>
          <div className="w-full max-w-md"><PartPicker listId={listId} placeholder="Add a Graco part from the price list…" onPick={addPart} /></div>
        </div>
        <div ref={grid} className="overflow-x-auto rounded-lg border border-slate-300">
          <table className="w-full min-w-[1150px] border-collapse">
            <colgroup>{[44, 120, 0, 64, 112, 120, 70, 112, 120, 78, 112, 40].map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}</colgroup>
            <thead><tr>{["S.NO", "MAKE", "DESCRIPTION", "QTY", "List Price", "Total List Price", "Dis %", "Landed Price", "Total Landed", "Margin %", "Unit Price", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const it = items[i], blank = isBlankItem(it), manual = !(it.listPrice > 0);
                return (
                  <tr key={i} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border border-slate-200 bg-slate-100 px-2 py-1.5 text-center text-sm font-medium text-slate-500">{blank ? "" : rowLetter(rows.slice(0, i).filter((x) => !isBlankItem(toItem(x))).length)}</td>
                    {cell(i, "make", "text-left")}{cell(i, "description", "text-left")}{cell(i, "qty", "text-center")}{cell(i, "listPrice")}
                    <td className={ro}>{it.listPrice > 0 ? inr(itemTotalList(it)) : ""}</td>
                    {cell(i, "discountPct", "text-center", manual ? "opacity-30" : "")}
                    {manual ? cell(i, "landed") : <td className={ro}>{inr(itemLanded(it))}</td>}
                    <td className={ro}>{blank ? "" : inr(itemTotalLanded(it))}</td>
                    {cell(i, "marginPct", "text-center")}
                    <td className={`${ro} font-semibold`}>{blank ? "" : inr(itemUnitPrice(it))}</td>
                    <td className="border border-slate-200 text-center"><button type="button" title="Delete row" onClick={() => setRows((rs) => withSpare(rs.length > 1 ? rs.filter((_, j) => j !== i) : [blankRow()]))} className="p-1 text-slate-300 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-semibold">
                <td colSpan={5} className="border border-slate-200 px-2 py-2 text-right text-xs uppercase tracking-wide text-slate-500">Totals</td>
                <td className={`${ro} !bg-slate-100`}>{inr(sum.list)}</td><td className="border border-slate-200" /><td className="border border-slate-200" />
                <td className={`${ro} !bg-slate-100`}>{inr(sum.landed)}</td><td className="border border-slate-200" /><td className={`${ro} !bg-slate-100`}>{inr(sum.unit)}</td><td className="border border-slate-200" />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="text-sm font-medium text-brand-600" onClick={() => setRows([...rows, blankRow()])}><Plus className="mr-1 inline h-3.5 w-3.5" />Add row</button>
          <p className="text-xs text-slate-500">Unit price = landed × (1 + margin %), rounded up to the next rupee. The <b>Total Unit Price</b> (₹{inr(sum.price)}) is the price this BOM brings to a quotation.</p>
        </div>
      </section>
    </>
  );
}
