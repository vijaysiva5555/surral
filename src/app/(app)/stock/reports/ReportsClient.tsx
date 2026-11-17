"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";
import { LOW_STOCK, addDays, dayLabel, periodRange, qtyText, stockLevel, type LedgerRow, type Period } from "@/lib/stockCalc";
import { useDebouncedLoad } from "@/lib/useDebouncedLoad";

type Kind = "stock" | "outward" | "inward" | "low";
type DocLine = { id: string; date: string; no: string; party: string; pn: string; desc: string; qty: number; remarks: string };
const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: "stock", label: "Stock summary", hint: "Per part: opening balance at the start of the period, inward, outward and the balance at its end" },
  { key: "outward", label: "Outward register", hint: "Every outward invoice line in the period" },
  { key: "inward", label: "Inward register", hint: "Every inward entry line in the period" },
  { key: "low", label: "Low stock", hint: `Parts with ${LOW_STOCK} or less in stock at the end of the period` },
];
const PERIODS: { key: Period; label: string }[] = [{ key: "day", label: "Daily" }, { key: "week", label: "Weekly" }, { key: "month", label: "Monthly" }, { key: "year", label: "Yearly" }, { key: "range", label: "Date range" }];
const LEVEL_CLS = { negative: "bg-red-100 font-bold text-red-700", out: "bg-red-50 font-semibold text-red-600", low: "bg-amber-50 font-semibold text-amber-700", ok: "font-semibold text-slate-900" };

export default function ReportsClient() {
  const [kind, setKind] = useState<Kind>("stock"); const [period, setPeriod] = useState<Period>("day");
  const [date, setDate] = useState(""); const [to, setTo] = useState("");
  const [q, setQ] = useState(""); const [moved, setMoved] = useState(true);
  const [data, setData] = useState<{ span: string; from: string; to: string; rows?: LedgerRow[]; lines?: DocLine[]; totals: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState("");

  const query = useMemo(() => new URLSearchParams({ kind, period, ...(date ? { date } : {}), ...(period === "range" && to ? { to } : {}), q, ...(moved && kind === "stock" ? { moved: "1" } : {}) }).toString(), [kind, period, date, to, q, moved]);
  const skipLoad = useRef(false);   // set when the first answer fills in the dates, so the same report is not fetched twice
  const load = useCallback(async () => {
    if (skipLoad.current) { skipLoad.current = false; return; }
    setLoading(true); setErr("");
    try { const r = await api(`/api/stock/reports?${query}`); setData(r); if (!date) { skipLoad.current = true; setDate(r.from); setTo(r.to); } }
    catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  useDebouncedLoad(load, [load]);

  /** previous / next day, week, month or year */
  const step = (dir: 1 | -1) => {
    if (!data || period === "range") return;
    setDate(dir === 1 ? addDays(data.to, 1) : addDays(data.from, -1));
  };
  const pickPeriod = (p: Period) => { if (p === "range" && data) { setDate(data.from); setTo(data.to); } setPeriod(p); };
  const rows = data?.rows ?? [], lines = data?.lines ?? [];
  const count = kind === "stock" || kind === "low" ? rows.length : lines.length;

  return (
    <>
      <PageHeader title="Stock reports" subtitle={data ? `${KINDS.find((k) => k.key === kind)!.label} · ${data.span}` : "Loading…"}>
        <a className={`btn-primary ${count === 0 ? "pointer-events-none opacity-50" : ""}`} href={`/api/stock/reports?${query}&format=xlsx`}><Download className="h-4 w-4" />Export Excel</a>
      </PageHeader>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Report">
            {KINDS.map((k) => <button key={k.key} role="tab" aria-selected={kind === k.key} title={k.hint} className={kind === k.key ? "btn-primary !py-2" : "btn-ghost !py-2"} onClick={() => setKind(k.key)}>{k.label}</button>)}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Period">
              {PERIODS.map((p) => <button key={p.key} role="tab" aria-selected={period === p.key} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${period === p.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} onClick={() => pickPeriod(p.key)}>{p.label}</button>)}
            </div>
            <div className="flex items-end gap-1">
              {period !== "range" && <button className="btn-ghost !px-2.5" title="Previous" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></button>}
              <div><label className="label">{period === "range" ? "From" : period === "day" ? "Date" : "Any day in the period"}</label><input type="date" className="input !w-36 sm:!w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
              {period === "range" && <div><label className="label">To</label><input type="date" className="input !w-36 sm:!w-40" value={to} min={date} onChange={(e) => e.target.value && setTo(e.target.value)} /></div>}
              {period !== "range" && <button className="btn-ghost !px-2.5" title="Next" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></button>}
            </div>
            {data && period !== "day" && period !== "range" && <span className="pb-2.5 text-sm text-slate-500">{data.span}{period === "year" && " (financial year)"}</span>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder={kind === "stock" || kind === "low" ? "Search part no., description or location…" : "Search invoice no., name, part no. or description…"} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {kind === "stock" && <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={moved} onChange={(e) => setMoved(e.target.checked)} />Only parts that moved in the period</label>}
          </div>
          <p className="text-xs text-slate-500">{KINDS.find((k) => k.key === kind)!.hint}. Export Excel downloads exactly what is listed below.</p>
          {err && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
        </div>

        <div className="overflow-x-auto">
          {(kind === "stock" || kind === "low") ? (
            <table className="w-full">
              <thead><tr><th className="th hidden md:table-cell w-12">S.No</th><th className="th hidden sm:table-cell w-28">Location</th><th className="th md:w-36">Part no.</th><th className="th hidden md:table-cell">Item Description</th>
                {kind === "stock" && <><th className="th !px-2 text-right sm:!px-4 md:w-28"><span className="md:hidden">Op.</span><span className="hidden md:inline">Op. Balance</span></th><th className="th !px-2 text-right sm:!px-4 md:w-24"><span className="md:hidden">In</span><span className="hidden md:inline">Inward</span></th><th className="th !px-2 text-right sm:!px-4 md:w-24"><span className="md:hidden">Out</span><span className="hidden md:inline">Outward</span></th></>}
                <th className="th !px-2 text-right sm:!px-4 md:w-36">{kind === "low" ? "Balance" : <><span className="lg:hidden">Balance</span><span className="hidden lg:inline">Current Balance</span></>}</th></tr></thead>
              <tbody>
                {loading && rows.length === 0 && <tr><td colSpan={8} className="td text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={8} className="td py-10 text-center text-slate-400">{kind === "low" ? "No parts are low on stock." : moved ? "No part moved in this period." : "No parts found."}</td></tr>}
                {rows.map((r, i) => (
                  <tr key={r.pn} className="hover:bg-slate-50">
                    <td className="td hidden md:table-cell !py-2 text-xs text-slate-400">{i + 1}</td><td className="td hidden sm:table-cell !py-2">{r.location}</td>
                    <td className="td !py-2"><span className="font-mono text-xs font-semibold">{r.pn}</span><div className="text-xs text-slate-500 md:hidden">{r.desc}{r.location && <span className="text-slate-400 sm:hidden"> · {r.location}</span>}</div></td>
                    <td className="td hidden md:table-cell !py-2">{r.desc}</td>
                    {kind === "stock" && <><td className="td !px-2 !py-2 text-right tabular-nums sm:!px-4">{qtyText(r.opening)}</td><td className="td !px-2 !py-2 text-right tabular-nums text-emerald-700 sm:!px-4">{r.inward ? qtyText(r.inward) : ""}</td><td className="td !px-2 !py-2 text-right tabular-nums text-red-600 sm:!px-4">{r.outward ? qtyText(r.outward) : ""}</td></>}
                    <td className={`td !px-2 !py-2 text-right tabular-nums sm:!px-4 ${LEVEL_CLS[stockLevel(r.closing)]}`}>{qtyText(r.closing)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && kind === "stock" && data && (
                <tfoot><tr className="bg-slate-50 font-semibold"><td className="td hidden md:table-cell" /><td className="td hidden sm:table-cell" /><td className="td">Total · {rows.length.toLocaleString("en-IN")} parts</td><td className="td hidden md:table-cell" /><td className="td !px-2 text-right tabular-nums sm:!px-4">{qtyText(data.totals.opening)}</td><td className="td !px-2 text-right tabular-nums sm:!px-4">{qtyText(data.totals.inward)}</td><td className="td !px-2 text-right tabular-nums sm:!px-4">{qtyText(data.totals.outward)}</td><td className="td !px-2 text-right tabular-nums sm:!px-4">{qtyText(data.totals.closing)}</td></tr></tfoot>
              )}
            </table>
          ) : (
            <table className="w-full">
              <thead><tr><th className="th hidden sm:table-cell w-28">Date</th><th className="th sm:w-40">Invoice no.</th><th className="th hidden lg:table-cell">{kind === "inward" ? "Supplier" : "Customer"}</th><th className="th md:w-36">Part no.</th><th className="th hidden md:table-cell">Item Description</th><th className="th w-16 text-right sm:w-24">Qty</th></tr></thead>
              <tbody>
                {loading && lines.length === 0 && <tr><td colSpan={6} className="td text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
                {!loading && lines.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-slate-400">No {kind} entries in this period.</td></tr>}
                {lines.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="td hidden sm:table-cell !py-2 whitespace-nowrap tabular-nums">{dayLabel(l.date)}</td>
                    <td className="td !py-2"><Link href={`/stock/${kind}/${l.id}`} className="break-all font-medium text-brand-700">{l.no || "—"}</Link><div className="whitespace-nowrap text-xs tabular-nums text-slate-500 sm:hidden">{dayLabel(l.date)}</div><div className="text-xs text-slate-500 lg:hidden">{l.party}</div></td>
                    <td className="td hidden lg:table-cell !py-2">{l.party}</td><td className="td !py-2"><span className="font-mono text-xs font-semibold">{l.pn}</span><div className="text-xs text-slate-500 md:hidden">{l.desc}</div></td><td className="td hidden md:table-cell !py-2">{l.desc}</td>
                    <td className="td !py-2 text-right font-medium tabular-nums">{qtyText(l.qty)}</td>
                  </tr>
                ))}
              </tbody>
              {lines.length > 0 && data && <tfoot><tr className="bg-slate-50 font-semibold"><td className="td hidden sm:table-cell" /><td className="td" colSpan={2}>Total · {data.totals.invoices} invoice{data.totals.invoices === 1 ? "" : "s"} · {lines.length.toLocaleString("en-IN")} lines</td><td className="td hidden lg:table-cell" /><td className="td hidden md:table-cell" /><td className="td text-right tabular-nums">{qtyText(data.totals.qty)}</td></tr></tfoot>}
            </table>
          )}
        </div>
      </div>
    </>
  );
}
