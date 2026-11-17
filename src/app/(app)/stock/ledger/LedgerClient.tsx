"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2, Plus, Search, Trash2, Upload, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StockPartInput from "@/components/StockPartInput";
import { api } from "@/lib/client";
import { LOW_STOCK, addDays, dayLabel, fyOf, ledgerTotals, periodRange, qtyText, stockLevel, type LedgerRow } from "@/lib/stockCalc";
import { useDebouncedLoad } from "@/lib/useDebouncedLoad";

type Field = "location" | "desc" | "inward" | "outward";
type SaveState = { state: "idle" | "saving" | "saved" | "error"; text?: string; at?: string };
const COLS: Field[] = ["location", "desc", "inward", "outward"];
const isNum = (f: Field) => f === "inward" || f === "outward";
const LEVEL_CLS = { negative: "bg-red-100 font-bold text-red-700", out: "bg-red-50 font-semibold text-red-600", low: "bg-amber-50 font-semibold text-amber-700", ok: "bg-emerald-50/60 font-semibold text-slate-900" };
const PAGE_SIZES = [100, 250, 500];

/** One editable cell. The text being typed lives here, so typing never re-renders the sheet; the value is sent when
    the cell is left (or Enter is pressed) and only if it changed. */
function Cell({ row, index, field, value, min, hide = "", onSave }: { row: LedgerRow; index: number; field: Field; value: string; min?: number; hide?: string; onSave: (row: LedgerRow, field: Field, value: string, undo: () => void) => void }) {
  const [text, setText] = useState(value);
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(value); setBad(false); }, [value]);
  const commit = () => {
    const next = isNum(field) ? (text.trim() === "" ? "0" : text.trim()) : text.trim();
    if (isNum(field) && String(Number(next)) === String(Number(value))) { setText(value); return; }
    if (!isNum(field) && next === value) { setText(value); return; }
    onSave(row, field, next, () => { setText(value); setBad(true); });
  };
  const move = (dr: number) => { const el = document.querySelector<HTMLInputElement>(`[data-cell="${index + dr}:${field}"]`); if (el) { el.focus(); el.select(); } };
  return (
    <td className={`border border-slate-200 p-0 ${hide} ${bad ? "bg-red-50" : ""}`}>
      <input data-cell={`${index}:${field}`} className={`xl-inp ${isNum(field) ? "text-right tabular-nums" : ""}`} value={isNum(field) && text === "0" ? "" : text} placeholder={isNum(field) ? "0" : ""}
        inputMode={isNum(field) ? "decimal" : undefined} title={min ? `${qtyText(min)} of this comes from ${field === "inward" ? "inward entries" : "outward invoices"} and cannot be lowered here` : undefined}
        onChange={(e) => { const v = e.target.value; if (!isNum(field) || /^\d*\.?\d{0,2}$/.test(v)) { setText(v); setBad(false); } }}
        onFocus={(e) => e.target.select()} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); commit(); move(1); }
          else if (e.key === "ArrowUp") { e.preventDefault(); commit(); move(-1); }
          else if (e.key === "Escape") { setText(value); (e.target as HTMLInputElement).blur(); }
        }} />
    </td>
  );
}

const Row = memo(function Row({ row, index, sn, editable, onSave, onOpen }: { row: LedgerRow; index: number; sn: number; editable: boolean; onSave: (row: LedgerRow, field: Field, value: string, undo: () => void) => void; onOpen: (row: LedgerRow) => void }) {
  const num = (n: number) => (n ? qtyText(n) : "");
  return (
    <tr>
      <td className="xl-sn hidden sm:table-cell">{sn}</td>
      {editable ? <Cell row={row} index={index} field="location" value={row.location} hide="hidden sm:table-cell" onSave={onSave} /> : <td className="xl-ro hidden sm:table-cell">{row.location}</td>}
      <td className="xl-ro overflow-hidden font-mono text-xs font-semibold text-slate-900">
        {editable ? <button type="button" className="max-w-full truncate whitespace-nowrap hover:text-brand-600 hover:underline" title="Part details and opening stock" onClick={() => onOpen(row)}>{row.pn}</button> : <span className="whitespace-nowrap">{row.pn}</span>}
        {/* phones have no room for location and description columns: both sit under the part number instead */}
        {(row.desc || row.location) && <div className="truncate font-sans text-[11px] font-normal text-slate-500 md:hidden">{row.location && <span className="font-medium text-slate-600 sm:hidden">{row.location}{row.desc && " · "}</span>}{row.desc}</div>}
      </td>
      {editable ? <Cell row={row} index={index} field="desc" value={row.desc} hide="hidden md:table-cell" onSave={onSave} /> : <td className="xl-ro hidden md:table-cell">{row.desc}</td>}
      <td className="xl-ro !px-1.5 text-right sm:!px-2">{qtyText(row.opening)}</td>
      {editable ? <Cell row={row} index={index} field="inward" value={qtyText(row.inward)} min={row.docIn} onSave={onSave} /> : <td className="xl-ro text-right">{num(row.inward)}</td>}
      {editable ? <Cell row={row} index={index} field="outward" value={qtyText(row.outward)} min={row.docOut} onSave={onSave} /> : <td className="xl-ro text-right">{num(row.outward)}</td>}
      <td className={`border border-slate-200 px-1.5 py-1.5 text-right text-sm tabular-nums sm:px-2 ${LEVEL_CLS[stockLevel(row.closing)]}`}>{qtyText(row.closing)}</td>
    </tr>
  );
});

export default function LedgerClient({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [today, setToday] = useState("");
  const [q, setQ] = useState(""); const [location, setLocation] = useState(""); const [level, setLevel] = useState(""); const [moved, setMoved] = useState(false);
  const [rows, setRows] = useState<LedgerRow[]>([]); const [locations, setLocations] = useState<string[]>([]); const [parts, setParts] = useState(0);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  const [save, setSave] = useState<SaveState>({ state: "idle" });
  const [page, setPage] = useState(1); const [size, setSize] = useState(250);
  const [adding, setAdding] = useState(false); const [importing, setImporting] = useState(false); const [detail, setDetail] = useState<LedgerRow | null>(null);
  const pending = useRef(0);
  const skipLoad = useRef(false);   // set when the first answer fills in the dates, so the same day is not fetched twice

  // the level filter comes from the dashboard / bell link (?level=low)
  useEffect(() => { const l = new URLSearchParams(window.location.search).get("level"); if (l) setLevel(l); }, []);

  const query = useMemo(() => new URLSearchParams({ ...(from ? { from, to: to || from } : {}), q, location, level, ...(moved ? { moved: "1" } : {}) }).toString(), [from, to, q, location, level, moved]);
  const load = useCallback(async () => {
    if (skipLoad.current) { skipLoad.current = false; return; }
    setLoading(true); setErr("");
    try {
      const r = await api(`/api/stock/ledger?${query}`);
      setRows(r.rows); setLocations(r.locations); setParts(r.parts); setToday(r.today);
      if (!from) { skipLoad.current = true; setFrom(r.from); setTo(r.to); }
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  useDebouncedLoad(load, [load]);
  useEffect(() => { setPage(1); }, [query, size]);

  const single = !!from && from === to;
  const editable = canEdit && single;
  const totals = useMemo(() => ledgerTotals(rows), [rows]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const shown = useMemo(() => rows.slice((page - 1) * size, page * size), [rows, page, size]);
  const counts = useMemo(() => ({ low: rows.filter((r) => r.closing > 0 && r.closing <= LOW_STOCK).length, out: rows.filter((r) => r.closing === 0).length, negative: rows.filter((r) => r.closing < 0).length }), [rows]);

  /** autosave of one cell: the server recalculates the row, the sheet shows what it sent back */
  const onSave = useCallback(async (row: LedgerRow, field: Field, value: string, undo: () => void) => {
    pending.current++; setSave({ state: "saving" });
    try {
      const r = await api("/api/stock/ledger", { method: "PATCH", json: { pn: row.pn, field, date: from, value: isNum(field) ? Number(value) : value } });
      setRows((list) => list.map((x) => (x.pn === row.pn ? r.row : x)));
      pending.current--;
      if (pending.current === 0) setSave({ state: "saved", at: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) });
    } catch (e) {
      pending.current--; undo();
      setSave({ state: "error", text: (e as Error).message });
    }
  }, [from]);

  const setDay = (d: string) => { setFrom(d); setTo(d); };
  const setRange = (r: { from: string; to: string }) => { setFrom(r.from); setTo(r.to); };
  const exportHref = `/api/stock/reports?kind=stock&period=range&date=${from}&to=${to}&q=${encodeURIComponent(q)}${moved ? "&moved=1" : ""}&format=xlsx`;

  return (
    <>
      <PageHeader title="Stock ledger" subtitle={from ? `${single ? dayLabel(from) : `${dayLabel(from)} to ${dayLabel(to)}`} · ${rows.length.toLocaleString("en-IN")} of ${parts.toLocaleString("en-IN")} parts` : "Loading…"}>
        <a className="btn-ghost" href={exportHref}><Download className="h-4 w-4" />Export Excel</a>
        {canEdit && <button className="btn-ghost" onClick={() => setImporting(true)}><Upload className="h-4 w-4" />Import Excel</button>}
        {canEdit && <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add part</button>}
      </PageHeader>

      {err && <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}<button onClick={() => setErr("")}><X className="h-4 w-4" /></button></div>}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-end gap-1">
              <button className="btn-ghost !px-2.5" title="Previous day" disabled={!from} onClick={() => setDay(addDays(from, -1))}><ChevronLeft className="h-4 w-4" /></button>
              <div><label className="label">{single ? "Date" : "From"}</label><input type="date" className="input !w-40" value={from} onChange={(e) => { if (!e.target.value) return; if (single) setDay(e.target.value); else setFrom(e.target.value); }} /></div>
              {!single && <div><label className="label">To</label><input type="date" className="input !w-40" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></div>}
              <button className="btn-ghost !px-2.5" title="Next day" disabled={!from} onClick={() => setDay(addDays(single ? from : to, 1))}><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button className={single && from === today ? "btn-primary !py-2" : "btn-ghost !py-2"} onClick={() => setDay(today)}>Today</button>
              <button className="btn-ghost !py-2" disabled={!from} onClick={() => setRange(periodRange("month", single ? from : to))}>Month</button>
              <button className="btn-ghost !py-2" disabled={!from} title="1 April to 31 March" onClick={() => setRange({ from: fyOf(single ? from : to).from, to: today > fyOf(single ? from : to).to ? fyOf(single ? from : to).to : today })}>Financial year</button>
            </div>
            <div className="ml-auto flex items-center gap-2 text-sm" aria-live="polite">
              {save.state === "saving" && <span className="flex items-center gap-1.5 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span>}
              {save.state === "saved" && <span className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Saved {save.at}</span>}
              {save.state === "idle" && editable && <span className="text-slate-400">Changes save automatically</span>}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_auto_auto_auto] xl:items-center">
            <div className="relative sm:col-span-2 xl:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Search part no., description or location…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input xl:w-44" aria-label="Filter by location" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All locations</option><option value="-">No location</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="input xl:w-52" aria-label="Filter by stock level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All stock levels</option><option value="low">Low stock ({LOW_STOCK} or less)</option><option value="out">Out of stock (0 or less)</option><option value="negative">Negative</option><option value="ok">Above {LOW_STOCK}</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2 xl:col-span-1"><input type="checkbox" checked={moved} onChange={(e) => setMoved(e.target.checked)} />Only parts that moved</label>
          </div>
          {save.state === "error" && <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"><span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Not saved – {save.text}</span><button onClick={() => setSave({ state: "idle" })}><X className="h-4 w-4" /></button></div>}
          {canEdit && !single && from && <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600">This is a date range, so it is read only. Choose a single day (or press <b>Today</b>) to enter inward and outward quantities.</p>}
          {!canEdit && <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600">Read only – stock is entered by the stock team.</p>}
        </div>

        <div className="xl-sheet !rounded-none !border-0">
          <table className="table-fixed md:min-w-[40rem]">
            <thead>
              <tr>
                <th className="xl-th hidden w-10 sm:table-cell">S.No</th><th className="xl-th hidden w-[4.5rem] sm:table-cell md:w-20 xl:w-28">Location</th><th className="xl-th md:w-[7.5rem] xl:w-36">Part no.</th><th className="xl-th hidden md:table-cell">Item Description</th>
                <th className="xl-th w-12 md:w-[4.5rem] xl:w-28"><span className="md:hidden">Op.</span><span className="hidden md:inline">Op. Balance</span></th><th className="xl-th w-[3.75rem] md:w-[4.5rem] xl:w-28"><span className="md:hidden">In</span><span className="hidden md:inline">Inward</span></th><th className="xl-th w-[3.75rem] md:w-[4.5rem] xl:w-28"><span className="md:hidden">Out</span><span className="hidden md:inline">Outward</span></th><th className="xl-th w-16 md:w-20 xl:w-32"><span className="xl:hidden">Balance</span><span className="hidden xl:inline">Current Balance</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">{parts === 0 ? (canEdit ? "The stock ledger is empty. Import the Excel workbook or add the first part." : "The stock ledger is empty.") : "No parts match these filters."}</td></tr>}
              {shown.map((r, i) => <Row key={r.pn} row={r} index={i} sn={(page - 1) * size + i + 1} editable={editable} onSave={onSave} onOpen={setDetail} />)}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <td className="xl-sn hidden sm:table-cell" /><td className="xl-ro hidden sm:table-cell">Total</td><td className="xl-ro"><span className="sm:hidden">Total · </span>{rows.length.toLocaleString("en-IN")} parts</td>
                  <td className="xl-ro hidden font-normal text-slate-500 md:table-cell">{counts.low + counts.out + counts.negative > 0 && <>{counts.low} low · {counts.out} out of stock{counts.negative ? ` · ${counts.negative} negative` : ""}</>}</td>
                  <td className="xl-ro !px-1 text-right text-[11px] sm:!px-2 sm:text-sm">{qtyText(totals.opening)}</td><td className="xl-ro !px-1 text-right text-[11px] sm:!px-2 sm:text-sm">{qtyText(totals.inward)}</td><td className="xl-ro !px-1 text-right text-[11px] sm:!px-2 sm:text-sm">{qtyText(totals.outward)}</td><td className="xl-ro !px-1 text-right text-[11px] sm:!px-2 sm:text-sm">{qtyText(totals.closing)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {rows.length > PAGE_SIZES[0] && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2">Rows per page<select className="input !w-24 !py-1.5" value={size} onChange={(e) => setSize(Number(e.target.value))}>{PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <div className="flex items-center justify-center gap-2"><button className="btn-ghost !px-3 !py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button><span className="tabular-nums">Page {page} / {pages}</span><button className="btn-ghost !px-3 !py-1" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
          </div>
        )}
      </div>

      {adding && <AddPart date={single ? from : today} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
      {detail && <PartDetail row={detail} onClose={() => setDetail(null)} onDone={() => { setDetail(null); load(); }} />}
      {importing && <ImportModal date={single ? from : today} isAdmin={isAdmin} onClose={() => setImporting(false)} onDone={load} />}
    </>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className={`card flex max-h-[92dvh] w-full flex-col rounded-b-none sm:rounded-2xl ${wide ? "max-w-2xl" : "max-w-md"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
const qtyOk = (s: string) => /^\d*\.?\d{0,2}$/.test(s);

function AddPart({ date, onClose, onDone }: { date: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ pn: "", desc: "", location: "", opening: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [known, setKnown] = useState("");
  async function submit() {
    setBusy(true); setErr("");
    try { await api("/api/stock/ledger", { json: { ...f, opening: Number(f.opening || 0), date } }); onDone(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title="Add part to the ledger" onClose={onClose}>
      <div><label className="label">Part no.</label>
        <StockPartInput className="input font-mono" placeholder="Type a part number or description…" value={f.pn} onChange={(pn) => { setF({ ...f, pn }); setKnown(""); }}
          onPick={(p) => { setF((x) => ({ ...x, pn: p.pn, desc: x.desc || p.desc })); setKnown(p.inLedger ? `${p.pn} is already in the ledger (${qtyText(p.balance)} in stock).` : ""); }} />
        {known && <p className="mt-1 text-xs text-amber-700">{known}</p>}
      </div>
      <div><label className="label">Item description</label><input className="input" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Location</label><input className="input" placeholder="e.g. A-4" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        <div><label className="label">Opening stock</label><input className="input text-right tabular-nums" inputMode="decimal" placeholder="0" value={f.opening} onChange={(e) => qtyOk(e.target.value) && setF({ ...f, opening: e.target.value })} /></div>
      </div>
      <p className="text-xs text-slate-500">Opening stock is the quantity counted on {dayLabel(date)}, before any inward or outward entry.</p>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !f.pn.trim() || !!known} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Add part</button></div>
    </Modal>
  );
}

function PartDetail({ row, onClose, onDone }: { row: LedgerRow; onClose: () => void; onDone: () => void }) {
  const [opening, setOpening] = useState<string | null>(null);   // loaded: the first stock count is not the day's opening balance
  const [first, setFirst] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => {
    // the earliest possible day shows the first stock count as its opening balance
    api(`/api/stock/ledger?from=1900-01-01&to=1900-01-01&q=${encodeURIComponent(row.pn)}`).then((r) => { const x = (r.rows as LedgerRow[]).find((y) => y.pn === row.pn); setOpening(qtyText(x?.opening ?? 0)); setFirst(qtyText(x?.opening ?? 0)); }).catch((e) => setErr((e as Error).message));
  }, [row.pn]);
  async function saveOpening() {
    setBusy(true); setErr("");
    try { await api("/api/stock/ledger", { method: "PATCH", json: { pn: row.pn, field: "opening", value: Number(opening || 0) } }); onDone(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Remove ${row.pn} from the stock ledger? This cannot be undone.`)) return;
    setBusy(true); setErr("");
    try { await api(`/api/stock/ledger?pn=${encodeURIComponent(row.pn)}`, { method: "DELETE" }); onDone(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title={row.pn} onClose={onClose}>
      <p className="text-sm text-slate-600">{row.desc || "No description"}{row.location && <span className="ml-2 badge bg-slate-100 text-slate-600">{row.location}</span>}</p>
      <div><label className="label">Opening stock (first stock count)</label>
        <input className="input text-right tabular-nums" inputMode="decimal" disabled={opening === null} value={opening ?? ""} onChange={(e) => qtyOk(e.target.value) && setOpening(e.target.value)} />
        <p className="mt-1 text-xs text-slate-500">The quantity before any inward or outward entry. Changing it moves the balance of every day by the same amount – use it to correct a wrong stock count, not for daily movements.</p>
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="flex items-center justify-between gap-2">
        <button className="btn-ghost !text-red-600" disabled={busy} onClick={remove} title="Only a part with no inward / outward entries can be removed"><Trash2 className="h-4 w-4" />Remove part</button>
        <div className="flex gap-2"><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-primary" disabled={busy || opening === null || Number(opening || 0) === Number(first || 0)} onClick={saveOpening}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></div>
      </div>
    </Modal>
  );
}

type Report = { mode: "history" | "day"; date?: string; stats: Record<string, number | string>; issues: { sheet: string; row: number; text: string }[]; issueCount: number; existingParts?: number };

function ImportModal({ date, isAdmin, onClose, onDone }: { date: string; isAdmin: boolean; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null); const [day, setDay] = useState(date);
  const [report, setReport] = useState<Report | null>(null); const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false);

  async function send(f: File, mode: "preview" | "commit", d = day) {
    setBusy(true); setErr("");
    const fd = new FormData(); fd.append("file", f); fd.append("mode", mode); fd.append("date", d); if (replace) fd.append("replace", "1");
    try { const r = await api("/api/stock/import", { method: "POST", body: fd }); setReport(r.report); if (mode === "commit") { setDone(true); onDone(); } }
    catch (e) { setErr((e as Error).message); if (mode === "preview") setReport(null); }
    setBusy(false);
  }
  const s = report?.stats ?? {};
  const tiles: [string, string | number][] = !report ? [] : report.mode === "history"
    ? [["Parts", s.parts], ["Inward entries", s.inwardEntries], ["Outward invoices", s.outwardInvoices], ["Item lines", s.lines], ["Low stock", s.low], ["Out of stock", s.outOfStock], ["Negative", s.negative], ["Not stock items", s.outwardLinesNotStocked]]
    : [["Rows", s.rows], ["New parts", s.added], ["Rows changed", s.changed], ["Unchanged", s.unchanged], ["Opening differs", s.openingMismatch], ["Skipped", s.skipped]];
  const blocked = report?.mode === "history" && (report.existingParts ?? 0) > 0 && (!isAdmin || !replace);

  return (
    <Modal title="Import stock from Excel" onClose={onClose} wide>
      {done ? (
        <div className="py-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><p className="mt-3 text-lg font-semibold">Import finished</p>
          <p className="text-sm text-slate-500">{report?.mode === "history" ? `${s.parts} parts, ${s.inwardEntries} inward entries and ${s.outwardInvoices} outward invoices loaded.` : `${s.added} new parts, ${s.changed} rows changed on ${dayLabel(report?.date)}.`}</p>
          <button className="btn-primary mt-5" onClick={onClose}>Close</button></div>
      ) : (
        <>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setReport(null); send(f, "preview"); } }} />
          <button className="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-slate-500 hover:border-brand-500 hover:text-brand-600" onClick={() => fileRef.current?.click()}>
            <Upload className="mb-2 h-7 w-7" /><span className="font-medium">{file ? file.name : "Choose an Excel file (.xlsx)"}</span>
            <span className="mt-1 text-center text-xs">A day sheet with the columns Location, Part no., Item Description, Op. Balance, Inward, Outward –<br />or the yearly workbook with the sheets Opening stock, Inward and Outward.</span>
          </button>
          {busy && <div className="flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Working… a large workbook takes a little while</div>}
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          {report && (
            <>
              <p className="text-sm text-slate-700">{report.mode === "history"
                ? <>This is a <b>yearly workbook</b>: opening stock on {dayLabel(String(s.openingDate))}, then inward and outward from {dayLabel(String(s.from))} to {dayLabel(String(s.to))}.</>
                : <>This is a <b>day sheet</b>. Its Inward and Outward quantities become the totals for the date below; empty cells leave that day as it is.</>}</p>
              {report.mode === "day" && <div className="w-48"><label className="label">Date of this sheet</label><input type="date" className="input" value={day} onChange={(e) => { if (e.target.value && file) { setDay(e.target.value); send(file, "preview", e.target.value); } }} /></div>}
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">{tiles.map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 p-3"><div className="text-xl font-bold tabular-nums text-slate-900">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</div><div className="text-xs text-slate-500">{k}</div></div>)}</div>
              {report.mode === "history" && Number(s.linesWithoutPartNo) > 0 && <p className="text-xs text-slate-500">{Number(s.linesWithoutPartNo).toLocaleString("en-IN")} invoice lines have no part number and {Number(s.outwardLinesNotStocked).toLocaleString("en-IN")} outward lines are for parts that are not on the ledger. They are kept on their invoices but do not change stock.{Number(s.leadingZeroRepaired) > 0 && ` ${s.leadingZeroRepaired} part numbers that lost a leading zero in Excel were matched to the ledger.`}</p>}
              {report.mode === "history" && (report.existingParts ?? 0) > 0 && (
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />The stock ledger already holds {report.existingParts?.toLocaleString("en-IN")} parts. Loading a yearly workbook replaces all of it – every part, inward entry, outward invoice and ledger entry.</p>
                  {isAdmin ? <label className="mt-2 flex items-center gap-2 font-medium"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Replace everything in the stock ledger</label> : <p className="mt-2">Only an admin can do that.</p>}
                </div>
              )}
              {report.issueCount > 0 && (
                <div className="rounded-lg border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold">{report.issueCount} row{report.issueCount === 1 ? "" : "s"} to check</div>
                  <ul className="max-h-40 overflow-y-auto px-4 py-2 text-xs text-slate-600">{report.issues.map((i, n) => <li key={n} className="py-0.5">{i.row > 0 && <span className="text-slate-400">{i.sheet} row {i.row}: </span>}{i.text}</li>)}</ul>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!report || !file || busy || blocked} onClick={() => file && send(file, "commit")}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Import</button></div>
        </>
      )}
    </Modal>
  );
}
