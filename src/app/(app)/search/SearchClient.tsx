"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { History, Loader2, RotateCcw, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Pager from "@/components/Pager";
import { api } from "@/lib/client";
import { dmy, inr } from "@/lib/format";
import { QUOTE_STATUS_PATCH, quoteStatusLabel } from "@/lib/quoteStatus";

type Section = "equipment" | "spare" | "project";
type Row = {
  quoteId: string; section: Section; number: string; revision?: number; date: string; status: string;
  customerId?: string; customerName?: string; kind: string; code: string; description: string; offer?: string;
  qty: string; basicPrice: number; discountPct: number; unitPrice: number; agreement?: string;
};
type Summary = {
  code: string; description: string; kind: string; customerName?: string;
  lastPrice: number; lastBasic: number; lastDiscount: number; lastQty: string; lastDate: string;
  lastQuoteId: string; lastNumber: string; lastRevision?: number; lastSection: Section; lastStatus: string;
  minPrice: number; maxPrice: number; times: number;
};
type Result = { rows: Row[]; total: number; page: number; pages: number; summary: Summary[] };

const SECTION_LABEL: Record<Section, string> = { equipment: "Equipment", spare: "Spare", project: "Project" };
const SECTION_TONE: Record<Section, string> = { equipment: "bg-brand-50 text-brand-700", spare: "bg-violet-50 text-violet-700", project: "bg-emerald-50 text-emerald-700" };
const href = (s: Section, id: string) => `/${s === "project" ? "project" : s}/quotations/${id}`;
const num = (n: string, rev?: number) => (rev ? `${n} Rev ${rev}` : n);
const FILTERS = ["customerId", "q", "section", "status", "from", "to"] as const;
type Filters = Record<(typeof FILTERS)[number], string>;

export default function SearchClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const [f, setF] = useState<Filters>(() => Object.fromEntries(FILTERS.map((k) => [k, sp.get(k) ?? ""])) as Filters);
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<{ _id: string; name: string }[]>([]);
  const [d, setD] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof Filters, v: string) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };

  useEffect(() => { api("/api/customers").then((r) => setCustomers(r.items)).catch((e) => setErr(e.message)); }, []);
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    router.replace(`/search${qs.size ? `?${qs}` : ""}`, { scroll: false });   // the search can be bookmarked / shared
    let stale = false;   // a slower, older search must never overwrite the results of a newer one
    const t = setTimeout(() => {
      setBusy(true); setErr("");
      api<Result>(`/api/search/prices?${qs}&page=${page}`)
        .then((r) => { if (!stale) setD(r); })
        .catch((e) => { if (!stale) setErr(e.message); })
        .finally(() => { if (!stale) setBusy(false); });
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [f, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const customerName = customers.find((c) => c._id === f.customerId)?.name;
  const filtered = FILTERS.some((k) => f[k]);
  const perCustomer = !f.customerId;   // without a customer filter, the summary is per part *and* customer

  return (
    <>
      <PageHeader title="Advanced search" subtitle="Find what was quoted before – the last price given to a customer for a part, across Equipment, Spare and Project quotations" />
      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      {/* ---- filters ---- */}
      <div className="card mb-6 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="label">Customer</label>
            <select className="input" value={f.customerId} onChange={(e) => set("customerId", e.target.value)}>
              <option value="">All customers</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="label">Part code or description</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="e.g. 243188, SwitchTip, diaphragm pump…" value={f.q} onChange={(e) => set("q", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Section</label>
            <select className="input" value={f.section} onChange={(e) => set("section", e.target.value)}>
              <option value="">All sections</option>
              {(Object.keys(SECTION_LABEL) as Section[]).map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">All statuses</option>
              {QUOTE_STATUS_PATCH.map((s) => <option key={s} value={s}>{quoteStatusLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">From date</label>
            <input type="date" className="input" value={f.from} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div>
            <label className="label">To date</label>
            <input type="date" className="input" value={f.to} onChange={(e) => set("to", e.target.value)} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button type="button" className="btn-ghost" disabled={!filtered} onClick={() => { setF(Object.fromEntries(FILTERS.map((k) => [k, ""])) as Filters); setPage(1); }}>
              <RotateCcw className="h-4 w-4" />Clear filters
            </button>
            <span className="pb-2.5 text-xs text-slate-500">Tip: choose <b>Agree</b> status to see only prices the customer accepted.</span>
          </div>
        </div>
      </div>

      {/* ---- last price given ---- */}
      <div className="card mb-6 overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><History className="h-5 w-5" strokeWidth={1.75} /></span>
            <div>
              <div className="card-header-title">Last price given{customerName ? ` – M/s. ${customerName}` : ""}</div>
              <div className="card-header-sub">One row per part{perCustomer ? " and customer" : ""}: the most recent unit price quoted, with the lowest and highest price given</div>
            </div>
          </div>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem]">
            <thead>
              <tr>
                <th className="th">Part</th>
                {perCustomer && <th className="th">Customer</th>}
                <th className="th text-right">Last unit price</th>
                <th className="th">Last quoted</th>
                <th className="th text-right">Lowest – highest</th>
                <th className="th text-center">Times</th>
              </tr>
            </thead>
            <tbody>
              {!d && <tr><td colSpan={6} className="td text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
              {d?.summary.length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Nothing quoted matches these filters.</td></tr>}
              {d?.summary.map((s, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="td max-w-[22rem]">
                    {s.kind === "part" && s.code && <div className="font-mono text-xs font-semibold text-slate-700">{s.code}</div>}
                    <div className="font-medium text-slate-800">{s.description}</div>
                  </td>
                  {perCustomer && <td className="td text-slate-600">{s.customerName}</td>}
                  <td className="td text-right">
                    <div className="text-base font-bold tabular-nums text-slate-900">₹{inr(s.lastPrice)}</div>
                    <div className="text-xs tabular-nums text-slate-500">
                      {s.lastDiscount ? `₹${inr(s.lastBasic)} less ${s.lastDiscount}%` : "net price"} · qty {s.lastQty}
                    </div>
                  </td>
                  <td className="td whitespace-nowrap">
                    <Link href={href(s.lastSection, s.lastQuoteId)} className="font-medium text-brand-700 hover:underline">{num(s.lastNumber, s.lastRevision)}</Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">{dmy(s.lastDate)} <StatusBadge status={s.lastStatus} /></div>
                  </td>
                  <td className="td whitespace-nowrap text-right text-xs tabular-nums text-slate-600">
                    {s.minPrice === s.maxPrice ? `₹${inr(s.minPrice)}` : `₹${inr(s.minPrice)} – ₹${inr(s.maxPrice)}`}
                  </td>
                  <td className="td text-center tabular-nums text-slate-600">{s.times}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- full history ---- */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <div className="card-header-title">Quotation history</div>
            <div className="card-header-sub">Every matching quotation line, newest first</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem]">
            <thead>
              <tr>
                <th className="th">Date</th>
                <th className="th">Quotation</th>
                {perCustomer && <th className="th">Customer</th>}
                <th className="th">Part / item</th>
                <th className="th">Qty</th>
                <th className="th text-right">Basic</th>
                <th className="th text-center">Disc.</th>
                <th className="th text-right">Unit price</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {!d && <tr><td colSpan={9} className="td text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
              {d?.rows.length === 0 && <tr><td colSpan={9} className="td py-8 text-center text-slate-400">No quotation lines found.</td></tr>}
              {d?.rows.map((r, i) => (
                <tr key={`${r.quoteId}-${i}`} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap text-xs">{dmy(r.date)}</td>
                  <td className="td whitespace-nowrap">
                    <Link href={href(r.section, r.quoteId)} className="font-medium text-brand-700 hover:underline">{num(r.number, r.revision)}</Link>
                    <div><span className={`badge mt-1 ${SECTION_TONE[r.section]}`}>{SECTION_LABEL[r.section]}</span></div>
                  </td>
                  {perCustomer && <td className="td max-w-[14rem] text-slate-600">{r.customerName}</td>}
                  <td className="td max-w-[22rem]">
                    {r.kind === "part" && r.code && <div className="font-mono text-xs font-semibold text-slate-700">{r.code}</div>}
                    <div className="text-slate-800">{r.description}</div>
                    {r.offer && <div className="text-xs text-slate-400">{r.offer}</div>}
                    {r.agreement && <div className="text-xs text-emerald-600">{r.agreement}</div>}
                  </td>
                  <td className="td whitespace-nowrap text-xs">{r.qty}</td>
                  <td className="td text-right tabular-nums">₹{inr(r.basicPrice)}</td>
                  <td className="td text-center text-xs text-slate-500">{r.discountPct ? `${r.discountPct}%` : "—"}</td>
                  <td className="td text-right font-semibold tabular-nums">₹{inr(r.unitPrice)}</td>
                  <td className="td"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d && <Pager page={page} pages={d.pages} total={d.total} set={setPage} />}
      </div>
    </>
  );
}
