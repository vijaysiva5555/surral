/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";
import { bomPage } from "@/lib/pageAccess";
import { useCan } from "@/components/PermsContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Save, Plus, Trash2, Loader2, Copy, FileSpreadsheet, ImagePlus, ClipboardPaste, Undo2, ListPlus, X, Layers, FolderPlus, FileUp } from "lucide-react";
import { api } from "@/lib/client";
import { resizeImage } from "@/lib/clientImage";
import { pickList } from "@/lib/priceLists";
import { bomSections, bomSummary, isBlankItem, itemLanded, itemTotalLanded, itemTotalList, itemTotalUnit, itemTotalUnit2, itemUnitPrice, itemUnitPrice2, rowLetter, type BomItem } from "@/lib/bomCalc";
import { parseBomPaste, type EditField } from "@/lib/bomPaste";
import { inr } from "@/lib/format";
import PartPicker from "@/components/PartPicker";
import AutoTextarea from "@/components/AutoTextarea";
import BomImportDialog, { type ImportChoice, type ImportedSheet } from "./BomImportDialog";
import type { BomCategory } from "@/lib/quoteCategory";
import { draftKey, draftWhen, useDraft } from "@/lib/useDraft";

type Row = Record<EditField, string>;
/** one sheet of the BOM: a name and its rows */
type Sec = { name: string; rows: Row[] };
const blankRow = (): Row => ({ make: "", description: "", qty: "1", listPrice: "", discountPct: "", landed: "", marginPct: "20", margin2Pct: "", notes: "" });
const blankSec = (name = ""): Sec => ({ name, rows: [blankRow(), blankRow(), blankRow()] });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const n = (s: string) => { const v = Number(String(s).replace(/,/g, "")); return Number.isFinite(v) ? v : 0; };
const toItem = (r: Row): BomItem => ({ make: r.make, description: r.description, qty: n(r.qty), listPrice: n(r.listPrice), discountPct: n(r.discountPct), landed: n(r.landed), marginPct: n(r.marginPct), margin2Pct: n(r.margin2Pct), ...(r.notes?.trim() ? { notes: r.notes.trim() } : {}) });
const fromItem = (i: any): Row => ({ make: i.make ?? "", description: i.description ?? "", qty: String(i.qty ?? 1), listPrice: i.listPrice ? String(i.listPrice) : "", discountPct: i.listPrice ? String(i.discountPct ?? 0) : "", landed: !i.listPrice && i.landed ? String(i.landed) : "", marginPct: String(i.marginPct ?? 20), margin2Pct: i.margin2Pct ? String(i.margin2Pct) : "", notes: i.notes ?? "" });
const blank = (r: Row) => isBlankItem(toItem(r));
/** visual column index of every editable field (S.NO=0 and the totals / unit prices are calculated) */
const COL: Record<EditField, number> = { make: 1, description: 2, qty: 3, listPrice: 4, discountPct: 6, landed: 7, marginPct: 9, margin2Pct: 12, notes: 15 };
const SECTION_HINTS = ["Graco Supply", "Surral Supply", "Spares", "Accessories", "Installation"];

export default function BomEditor({ id, userId, category, basePath }: { id?: string; userId: string; category: BomCategory; basePath: string }) {
  const router = useRouter();
  const editable = useCan()(bomPage(category), "edit");   // View only: the sheet opens read only (Administration → Page access)
  const [loading, setLoading] = useState(!!id); const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [name, setName] = useState(""); const [date, setDate] = useState(today());
  const [image, setImage] = useState<string | null>(null);
  const [secs, setSecs] = useState<Sec[]>([blankSec()]);
  const [lists, setLists] = useState<any[]>([]); const [saved, setSaved] = useState(""); const grid = useRef<HTMLDivElement>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);   // of the saved BOM; null until it has loaded

  useEffect(() => {
    api("/api/pricing/lists").then((r) => setLists(r.items)).catch(() => {});
    if (!id) return;
    api(`/api/bom/${id}`).then((r) => {
      const b = r.item; setName(b.name); setDate(b.date.slice(0, 10)); setImage(b.image ?? null);
      setSecs(bomSections(b).map((s) => ({ name: s.name, rows: [...s.items.map(fromItem), blankRow()] })));
      setUpdatedAt(String(b.updatedAt ?? "")); setLoading(false);
    }).catch((e) => { setMsg({ ok: false, t: e.message }); setLoading(false); });
  }, [id]);

  const listId = useMemo(() => (lists.length ? pickList(lists, date) : ""), [lists, date]);
  const secItems = useMemo(() => secs.map((s) => s.rows.map(toItem)), [secs]);
  const items = useMemo(() => secItems.flat(), [secItems]);
  const sum = useMemo(() => bomSummary({ items }), [items]);
  const many = secs.length > 1;
  const payload = useMemo(() => ({
    name, date, image,
    sections: many || secs[0]?.name.trim() ? secs.map((s) => s.name.trim()) : [],
    items: secs.flatMap((s, si) => secItems[si].filter((i) => !isBlankItem(i)).map((i) => (many || s.name.trim() ? { ...i, section: s.name.trim() } : i))),
  }), [name, date, image, secs, secItems, many]);
  useEffect(() => { if (!loading && id && !saved) setSaved(JSON.stringify(payload)); }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!id && saved !== "" && JSON.stringify(payload) !== saved;

  // ---- draft: the sheets are kept in this browser until Save, so leaving the page does not lose a half-entered BOM ----
  const formData = useMemo(() => ({ name, date, image, secs }), [name, date, image, secs]);
  const hasContent = !!name.trim() || !!image || items.some((i) => !isBlankItem(i)) || many;   // a new BOM is worth keeping
  const draft = useDraft({
    key: !loading && (id ? updatedAt !== null : true) ? draftKey("bom", userId, id, category) : null,
    data: formData, active: id ? dirty : hasContent, baseUpdatedAt: updatedAt || undefined,
    stripImages: (d) => ({ ...d, image: null }),
  });
  function restoreDraft() {
    const p = draft.pending, d = p?.data as any; if (!p || !d) return;
    setName(d.name ?? ""); setDate(d.date || today()); setImage(d.image ?? null);
    // a draft from before sections had one list of rows
    const ss: Sec[] = d.secs?.length ? d.secs : [{ name: "", rows: d.rows ?? [] }];
    setSecs(ss.map((s) => ({ name: s.name ?? "", rows: s.rows?.length ? s.rows.map((r) => ({ ...blankRow(), ...r })) : [blankRow()] })));
    draft.resolve(true);
    setMsg({ ok: true, t: p.imagesOmitted ? "Draft restored. The photo was too large to keep – add it again, then Save." : "Draft restored – press Save to keep it." });
  }

  // ---- cells ----
  const focusCell = (si: number, r: number, c: number) => setTimeout(() => { const el = grid.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-cell="${si}-${r}-${c}"]`); el?.focus(); el?.select(); }, 0);
  const setRowsOf = (si: number, fn: (rs: Row[]) => Row[]) => setSecs((ss) => ss.map((s, j) => (j === si ? { ...s, rows: fn(s.rows) } : s)));
  const setCell = (si: number, r: number, f: EditField, v: string) => setRowsOf(si, (rs) => rs.map((x, i) => (i === r ? { ...x, [f]: v } : x)));
  const withSpare = (rs: Row[]) => (rs.length && !blank(rs[rs.length - 1]) ? [...rs, blankRow()] : rs.length ? rs : [blankRow()]);

  function onKey(e: React.KeyboardEvent, si: number, r: number, c: number) {
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); if (r === secs[si].rows.length - 1) setRowsOf(si, (rs) => [...rs, blankRow()]); focusCell(si, r + 1, c); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (r > 0) focusCell(si, r - 1, c); }
  }
  function onPaste(e: React.ClipboardEvent, si: number, r: number, f: EditField) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.trim().includes("\n")) return;           // plain single-cell paste → let the browser do it
    e.preventDefault();
    const parsed = parseBomPaste(text, f);
    if (!parsed.length) { setMsg({ ok: false, t: "Nothing to paste – no rows with a MAKE or DESCRIPTION were found." }); return; }
    const whole = f === "make" || f === "description";
    setRowsOf(si, (rs) => {
      const out = [...rs];
      parsed.forEach((p, i) => { const idx = r + i; const base = whole ? blankRow() : out[idx] ?? blankRow(); out[idx] = { ...base, ...(p as Partial<Row>) }; });
      return withSpare(out.map((x) => x ?? blankRow()));
    });
    setMsg({ ok: true, t: `Pasted ${parsed.length} row${parsed.length > 1 ? "s" : ""}. Check the calculated columns, then Save.` });
  }
  async function lookup(si: number, r: number) {   // typing a Graco part number in MAKE fills the description / list price / discount from the price list
    const row = secs[si]?.rows[r], pn = row?.make.trim() ?? "";
    if (!row || !listId || !/^[A-Za-z0-9-]{4,}$/.test(pn) || (row.description && row.listPrice)) return;
    try {
      const res = await api(`/api/parts?q=${encodeURIComponent(pn)}&limit=10&listIds=${listId}`);
      const p = res.items.find((x: any) => x.pn.toLowerCase() === pn.toLowerCase());
      if (!p) return;
      setRowsOf(si, (rs) => rs.map((x, i) => (i === r ? { ...x, description: x.description || p.desc, listPrice: x.listPrice || (p.prices[listId] != null ? String(p.prices[listId]) : ""), discountPct: x.discountPct || (p.costDiscountPct != null ? String(p.costDiscountPct) : "") } : x)));
    } catch { /* silent */ }
  }
  function addPart(si: number, p: any) {
    setRowsOf(si, (rs) => { const row: Row = { ...blankRow(), make: p.pn, description: p.desc, listPrice: p.price != null ? String(p.price) : "", discountPct: p.costDiscountPct != null ? String(p.costDiscountPct) : "" }; const idx = rs.findIndex(blank); const out = idx >= 0 ? rs.map((x, i) => (i === idx ? row : x)) : [...rs, row]; return withSpare(out); });
  }

  // ---- add / remove items and sections ----
  const [removed, setRemoved] = useState<{ label: string; secs: Sec[] } | null>(null);   // the sheets before the last removal, for Undo
  const remember = (label: string) => setRemoved({ label, secs });
  function addItem(si: number) {
    const idx = secs[si].rows.findIndex(blank);
    if (idx < 0) setRowsOf(si, (rs) => [...rs, blankRow()]);
    focusCell(si, idx < 0 ? secs[si].rows.length : idx, COL.make);
  }
  function insertBelow(si: number, i: number) { setRowsOf(si, (rs) => [...rs.slice(0, i + 1), blankRow(), ...rs.slice(i + 1)]); focusCell(si, i + 1, COL.make); }
  function removeRow(si: number, i: number) {
    const r = secs[si].rows[i];
    if (!blank(r)) remember(`Removed “${r.description || r.make}”`);
    setRowsOf(si, (rs) => { const left = rs.filter((_, j) => j !== i); return withSpare(left.some((x) => !blank(x)) ? left : [blankRow()]); });
  }
  function clearSection(si: number) {
    const k = secs[si].rows.filter((r) => !blank(r)).length;
    if (!k || !confirm(`Remove all ${k} item${k === 1 ? "" : "s"} from ${secs[si].name ? `“${secs[si].name}”` : "this section"}?`)) return;
    remember(`Removed ${k} item${k === 1 ? "" : "s"}`);
    setRowsOf(si, () => [blankRow()]);
  }
  function addSection() {
    setSecs((ss) => [...ss, blankSec()]);
    setTimeout(() => { const el = grid.current?.querySelector<HTMLInputElement>(`[data-section="${secs.length}"]`); el?.scrollIntoView({ block: "center", behavior: "smooth" }); el?.focus(); }, 50);
  }
  function removeSection(si: number) {
    const k = secs[si].rows.filter((r) => !blank(r)).length;
    const label = secs[si].name ? `“${secs[si].name}”` : `section ${si + 1}`;
    if (k && !confirm(`Remove ${label} and its ${k} item${k === 1 ? "" : "s"}?`)) return;
    remember(`Removed ${label}`);
    setSecs((ss) => ss.filter((_, j) => j !== si));
  }
  const moveSection = (si: number, d: number) => setSecs((ss) => { const o = [...ss], k = si + d; if (k < 0 || k >= o.length) return ss; [o[si], o[k]] = [o[k], o[si]]; return o; });
  function undo() { if (removed) { setSecs(removed.secs); setRemoved(null); } }

  // ---- Excel import: the company's BOM workbook, one section per block ----
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ fileName: string; sheets: ImportedSheet[] } | null>(null);
  async function readExcel(file: File | undefined) {
    if (!file) return;
    setMsg(null); setImporting(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await api("/api/bom/import", { method: "POST", body: fd });
      setImported({ fileName: file.name, sheets: r.sheets });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setImporting(false);
  }
  function applyImport({ blocks, mode }: ImportChoice) {
    const hasItems = items.some((i) => !isBlankItem(i));
    const keep = mode === "add" && hasItems ? secs.filter((x) => x.rows.some((r) => !blank(r))) : [];
    // section names must differ: a repeated title gets (2), (3) …; an unnamed section next to imported ones becomes "Items"
    const used = new Set<string>();
    const unique = (n: string) => { let base = (n.trim() || "Items").slice(0, 74), name = base, k = 2; while (used.has(name.toLowerCase())) name = `${base} (${k++})`; used.add(name.toLowerCase()); return name; };
    const kept = keep.map((x) => ({ ...x, name: unique(x.name) }));
    const added: Sec[] = blocks.map((b) => ({ name: unique(b.title), rows: [...b.items.map(fromItem), blankRow()] }));
    remember(hasItems && mode === "replace" ? "Sections replaced by the Excel import" : "Excel import added");   // Undo puts the sheet back as it was
    setSecs([...kept, ...added]);
    if (!name.trim() && blocks.length === 1) setName(blocks[0].title.slice(0, 120));
    const n = blocks.reduce((t, b) => t + b.items.length, 0);
    setImported(null);
    setMsg({ ok: true, t: `Imported ${n} item${n === 1 ? "" : "s"} in ${blocks.length} section${blocks.length === 1 ? "" : "s"}. Check the sheet${!name.trim() && blocks.length > 1 ? ", enter the BOM name" : ""}, then press Save BOM.` });
  }

  async function save() {
    setMsg(null);
    const names = secs.map((s) => s.name.trim());
    if (many && names.some((x) => !x)) return setMsg({ ok: false, t: "Give every section a name (e.g. Graco Supply, Surral Supply)." });
    if (new Set(names).size !== names.length) return setMsg({ ok: false, t: "Two sections have the same name – give each its own name." });
    setSaving(true);
    try {
      if (id) { const r = await api(`/api/bom/${id}`, { method: "PUT", json: payload }); setSaved(JSON.stringify(payload)); setUpdatedAt(String(r.item?.updatedAt ?? "")); draft.clear(); setMsg({ ok: true, t: "BOM saved." }); }
      else { const r = await api(`/api/bom?category=${category}`, { json: { ...payload, category } }); draft.clear(true); router.replace(`${basePath}/${r.item._id}`); }
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setSaving(false);
  }
  async function dup() { if (dirty && !confirm("Unsaved changes will not be copied. Continue?")) return; try { const r = await api(`/api/bom/${id}/clone`, { method: "POST" }); router.push(`${basePath}/${r.item._id}`); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } }

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-slate-400" />;
  const shown = items.filter((i) => !isBlankItem(i)).length;
  const th = "border border-white/30 bg-brand-600 px-2 py-2 text-center text-xs font-semibold text-white";
  const ro = "border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-sm tabular-nums text-slate-700";
  const inp = "h-full w-full min-w-0 border-0 bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-brand-50 focus:ring-2 focus:ring-inset focus:ring-brand-500";
  // S.NO letters run on across the sections (a, b, c …), as on the quotation's "Consists of"
  const offsets = secItems.map((_, si) => secItems.slice(0, si).flat().filter((i) => !isBlankItem(i)).length);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={basePath} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></Link>
          <div><h1 className="text-xl font-bold text-slate-900">{id ? name || "BOM" : "New BOM"}</h1><div className="text-xs text-slate-500">{dirty ? <span className="font-medium text-amber-600">Unsaved changes</span> : `${shown} item${shown === 1 ? "" : "s"}${many ? ` in ${secs.length} sections` : ""}`}</div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {id && <><a className="btn-ghost" href={`/api/bom/${id}/excel`}><FileSpreadsheet className="h-4 w-4" />Excel</a>{editable && <button className="btn-ghost" onClick={dup}><Copy className="h-4 w-4" />Duplicate</button>}</>}
          {editable && (
            <label className={`btn-ghost cursor-pointer${importing || draft.pending ? " pointer-events-none opacity-60" : ""}`} title="Fill the BOM from your Excel BOM sheet (same format: S.NO, Part No, Description, Qty, List Price … Notes)">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}Import Excel
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => { readExcel(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          )}
          {editable && <button className="btn-primary" onClick={save} disabled={saving || !!draft.pending}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save BOM</button>}
        </div>
      </div>
      {draft.pending && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            {!id ? `You have an unfinished BOM from ${draftWhen(draft.pending.savedAt)}.`
              : draft.pending.baseUpdatedAt === (updatedAt || undefined) ? `You have unsaved changes from ${draftWhen(draft.pending.savedAt)}.`
              : `You have unsaved changes from ${draftWhen(draft.pending.savedAt)}, but this BOM has been saved since then – the saved version is newer. Restoring and saving will replace it.`}
            {" "}Choose one to go on editing.
          </span>
          <span className="flex shrink-0 gap-2">
            <button type="button" className="btn-primary !py-1.5" onClick={restoreDraft}>{id ? "Restore" : "Continue"}</button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => draft.resolve(false)}>{id ? "Discard" : "Start fresh"}</button>
          </span>
        </div>
      )}
      {msg && <p className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</p>}
      {imported && <BomImportDialog fileName={imported.fileName} sheets={imported.sheets} hasItems={items.some((i) => !isBlankItem(i))} onApply={applyImport} onClose={() => setImported(null)} />}
      {removed && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white shadow-xl">
          {removed.label}
          <button type="button" className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:text-sky-200" onClick={undo}><Undo2 className="h-4 w-4" />Undo</button>
          <button type="button" aria-label="Dismiss" onClick={() => setRemoved(null)}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
      )}

      {/* locked until the user has decided about a found draft, so neither the draft nor new typing can be lost */}
      <fieldset disabled={!!draft.pending || !editable} className="contents">
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

      <div ref={grid}>
        <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500"><ClipboardPaste className="h-3.5 w-3.5 shrink-0" />Type like in Excel (Enter / ↑ ↓ to move) or copy rows from your Excel BOM sheet and paste into the <b>MAKE</b> cell. White cells are typed; grey cells are calculated. Use <b>Add section</b> for another sheet (e.g. Graco Supply, Surral Supply, Spares).</p>

        {secs.map((sec, si) => {
          const its = secItems[si], sub = bomSummary({ items: its }), count = its.filter((i) => !isBlankItem(i)).length;
          const cell = (r: number, f: EditField, align = "text-right", extraCls = "") => (f === "description" || f === "notes"
            // the description and notes wrap and grow, so long text is shown in full
            ? <td className="border border-slate-200 p-0 align-top"><AutoTextarea data-cell={`${si}-${r}-${COL[f]}`} className={`${inp} block leading-snug ${align} ${extraCls}`} value={sec.rows[r][f]}
                onChange={(e) => setCell(si, r, f, e.target.value)} onKeyDown={(e) => onKey(e, si, r, COL[f])} onPaste={(e) => onPaste(e, si, r, f)} title={sec.rows[r][f] || undefined} /></td>
            : <td className="border border-slate-200 p-0"><input data-cell={`${si}-${r}-${COL[f]}`} className={`${inp} ${align} ${extraCls}`} value={sec.rows[r][f]} inputMode={f === "make" ? "text" : "decimal"}
                onChange={(e) => setCell(si, r, f, e.target.value)} onKeyDown={(e) => onKey(e, si, r, COL[f])} onPaste={(e) => onPaste(e, si, r, f)} onBlur={f === "make" ? () => lookup(si, r) : undefined} onFocus={(e) => e.target.select()} /></td>
          );
          let k = offsets[si];
          return (
            <section key={si} className="card mb-5 overflow-hidden">
              {/* section header: name, sub-total, order and remove */}
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-white px-5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">{si + 1}</span>
                <input data-section={si} className="input !w-auto min-w-[14rem] flex-1 !py-1.5 font-semibold" value={sec.name} list="bom-section-names"
                  placeholder={many ? "Section name, e.g. Surral Supply" : "Section name (optional), e.g. Graco Supply"} aria-label={`Name of section ${si + 1}`}
                  onChange={(e) => setSecs((ss) => ss.map((s, j) => (j === si ? { ...s, name: e.target.value } : s)))} />
                <span className="text-xs text-slate-500">{count} item{count === 1 ? "" : "s"} · <b className="tabular-nums text-slate-700">₹ {inr(sub.price)}</b></span>
                {editable && (
                  <span className="ml-auto flex items-center gap-1">
                    {many && <>
                      <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30" disabled={si === 0} onClick={() => moveSection(si, -1)} aria-label="Move section up" title="Move up"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30" disabled={si === secs.length - 1} onClick={() => moveSection(si, 1)} aria-label="Move section down" title="Move down"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50" onClick={() => removeSection(si)}><Trash2 className="h-4 w-4" />Remove section</button>
                    </>}
                  </span>
                )}
              </div>

              <div className="p-5">
                {editable && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button type="button" className="btn-primary !py-1.5" onClick={() => addItem(si)}><Plus className="h-4 w-4" />Add item</button>
                    <button type="button" className="btn-ghost !py-1.5" onClick={() => setRowsOf(si, (rs) => [...rs, ...Array.from({ length: 5 }, blankRow)])}><ListPlus className="h-4 w-4" />Add 5 rows</button>
                    {count > 0 && <button type="button" className="btn-ghost !py-1.5 text-red-600 hover:!bg-red-50" onClick={() => clearSection(si)}><Trash2 className="h-4 w-4" />Clear items</button>}
                    <div className="w-full sm:ml-auto sm:w-80"><PartPicker listId={listId} placeholder="Add a Graco part from the price list…" onPick={(p: any) => addPart(si, p)} /></div>
                  </div>
                )}
                <div className="overflow-x-auto rounded-lg border border-slate-300">
                  <table className="w-full min-w-[2140px] border-collapse">
                    <colgroup>{[92, 120, 0, 64, 112, 120, 70, 112, 120, 78, 112, 120, 84, 112, 120, 240].map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}</colgroup>
                    <thead><tr>{["S.NO", "MAKE", "DESCRIPTION", "QTY", "List Price", "Total List Price", "Dis %", "Landed Price", "Total Landed", "Margin %", "Unit Price", "Total Price", "Margin 2 %", "Unit Price", "Total Price", "Notes"].map((h, i) => <th key={i} className={`${th}${i >= 12 && i <= 14 ? " !bg-brand-700" : ""}${i === 15 ? " !bg-slate-600" : ""}${i === 0 ? " sticky left-0 z-20" : ""}`}>{h}</th>)}</tr></thead>
                    <tbody>
                      {sec.rows.map((r, i) => {
                        const it = its[i], empty = isBlankItem(it), manual = !(it.listPrice > 0);
                        const letter = empty ? "" : rowLetter(k++);
                        return (
                          <tr key={i} className="odd:bg-white even:bg-slate-50/40">
                            {/* kept in view while the sheet scrolls sideways; the shadow covers the strip Chrome leaves at a sticky cell's edge in a collapsed-border table */}
                            <td className="sticky left-0 z-10 border border-slate-200 bg-slate-100 px-1 py-1 shadow-[4px_0_0_0_#f1f5f9,5px_0_0_0_#cbd5e1]">
                              <div className="flex items-center justify-between gap-1">
                                <span className="w-6 text-center text-sm font-medium text-slate-500">{letter}</span>
                                {editable && <span className="flex">
                                  <button type="button" title="Insert an empty row below" aria-label={`Insert a row below row ${i + 1} of section ${si + 1}`} onClick={() => insertBelow(si, i)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-brand-600"><Plus className="h-3.5 w-3.5" /></button>
                                  <button type="button" title={empty ? "Remove this empty row" : "Remove this item"} aria-label={`Remove row ${i + 1} of section ${si + 1}`} onClick={() => removeRow(si, i)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                                </span>}
                              </div>
                            </td>
                            {cell(i, "make", "text-left")}{cell(i, "description", "text-left")}{cell(i, "qty", "text-center")}{cell(i, "listPrice")}
                            <td className={ro}>{it.listPrice > 0 ? inr(itemTotalList(it)) : ""}</td>
                            {cell(i, "discountPct", "text-center", manual ? "opacity-30" : "")}
                            {manual ? cell(i, "landed") : <td className={ro}>{inr(itemLanded(it))}</td>}
                            <td className={ro}>{empty ? "" : inr(itemTotalLanded(it))}</td>
                            {cell(i, "marginPct", "text-center")}
                            <td className={ro}>{empty ? "" : inr(itemUnitPrice(it))}</td>
                            <td className={`${ro} font-semibold`}>{empty ? "" : inr(itemTotalUnit(it))}</td>
                            {cell(i, "margin2Pct", "text-center")}
                            <td className={`${ro}${it.margin2Pct ? "" : " !text-slate-400"}`}>{empty ? "" : inr(itemUnitPrice2(it))}</td>
                            <td className={`${ro} font-semibold${it.margin2Pct ? "" : " !text-slate-400"}`}>{empty ? "" : inr(itemTotalUnit2(it))}</td>
                            {cell(i, "notes", "text-left")}
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-100 font-semibold">
                        <td colSpan={5} className="border border-slate-200 px-2 py-2 text-right text-xs uppercase tracking-wide text-slate-500">{many ? `${sec.name || `Section ${si + 1}`} total` : "Totals"} ({count} item{count === 1 ? "" : "s"})</td>
                        <td className={`${ro} !bg-slate-100`}>{inr(sub.list)}</td><td className="border border-slate-200" /><td className="border border-slate-200" />
                        <td className={`${ro} !bg-slate-100`}>{inr(sub.landed)}</td><td className="border border-slate-200" /><td className="border border-slate-200" /><td className={`${ro} !bg-slate-100`}>{inr(sub.unit)}</td>
                        <td className="border border-slate-200" /><td className="border border-slate-200" /><td className={`${ro} !bg-amber-100`}>{inr(sub.price)}</td><td className="border border-slate-200" />
                      </tr>
                    </tbody>
                  </table>
                </div>
                {editable && <button type="button" className="btn-ghost mt-3 !py-1.5" onClick={() => addItem(si)}><Plus className="h-4 w-4" />Add item</button>}
              </div>
            </section>
          );
        })}
        <datalist id="bom-section-names">{SECTION_HINTS.map((h) => <option key={h} value={h} />)}</datalist>
      </div>

      {editable && (
        <button type="button" onClick={addSection}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/40 px-4 py-5 text-sm font-semibold text-brand-700 transition hover:border-brand-500 hover:bg-brand-50">
          <FolderPlus className="h-5 w-5" />Add section – another sheet in this BOM (e.g. Surral Supply, Spares)
        </button>
      )}

      {/* the BOM total – all sections together */}
      <section className="card mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2"><Layers className="h-5 w-5 text-brand-600" /><h2 className="font-semibold text-slate-900">BOM total{many ? ` · ${secs.length} sections` : ""}</h2></div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">Total list price</dt><dd className="font-semibold tabular-nums">₹ {inr(sum.list)}</dd></div>
            <div><dt className="text-xs text-slate-500">Total landed</dt><dd className="font-semibold tabular-nums">₹ {inr(sum.landed)}</dd></div>
            <div><dt className="text-xs text-slate-500">Margin</dt><dd className="font-semibold tabular-nums">{sum.marginPct.toFixed(1)}%</dd></div>
            <div><dt className="text-xs text-slate-500">Total price</dt><dd className="rounded bg-amber-100 px-1.5 font-bold tabular-nums">₹ {inr(sum.price)}</dd></div>
          </dl>
        </div>
        {many && (
          <ul className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
            {secs.map((s, si) => <li key={si} className="rounded-full bg-slate-100 px-2.5 py-1">{s.name || `Section ${si + 1}`}: <b className="tabular-nums">₹ {inr(bomSummary({ items: secItems[si] }).price)}</b></li>)}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">Unit price = landed × (1 + margin %), rounded up to the next rupee. <b>Margin 2 %</b> is optional and is added on top of that unit price. The <b>Total price</b> (₹{inr(sum.price)}) is the price this BOM brings to a quotation.</p>
      </section>
      </fieldset>
    </>
  );
}
