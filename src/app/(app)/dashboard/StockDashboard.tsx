/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Boxes, PackageMinus, PackagePlus, TriangleAlert, type LucideIcon } from "lucide-react";
import { stockDashboard, type MoveTally } from "@/lib/stockDashboard";
import { LOW_STOCK, dayLabel, qtyText } from "@/lib/stockCalc";

const big = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function Level({ label, n, sub, tone, href }: { label: string; n: number; sub: string; tone: string; href: string }) {
  return (
    <Link href={href} className="card block p-4 transition hover:shadow-md sm:p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${tone}`}>{n.toLocaleString("en-IN")}</div>
      <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
    </Link>
  );
}

function Movement({ label, t }: { label: string; t: MoveTally }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-2">
        <div className="min-w-[7rem] flex-1"><div className="text-xl font-bold tabular-nums text-emerald-700">+{big(t.inQty)}</div><div className="text-xs text-slate-500">inward · {t.inDocs} entr{t.inDocs === 1 ? "y" : "ies"}</div></div>
        <div className="min-w-[7rem] flex-1"><div className="text-xl font-bold tabular-nums text-red-600">−{big(t.outQty)}</div><div className="text-xs text-slate-500">outward · {t.outDocs} invoice{t.outDocs === 1 ? "" : "s"}</div></div>
      </div>
    </div>
  );
}

function Docs({ title, icon: Icon, tone, rows, path, empty }: { title: string; icon: LucideIcon; tone: string; rows: any[]; path: string; empty: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" strokeWidth={1.75} /></span><h2 className="font-semibold text-slate-900">{title}</h2></div>
        <Link href={path} className="shrink-0 whitespace-nowrap text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>
      </div>
      {rows.length === 0 ? <p className="px-5 py-6 text-sm text-slate-400">{empty}</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((d) => (
            <li key={String(d._id)} className="px-5 py-3 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <Link href={`${path}/${d._id}`} className="truncate text-sm font-medium text-brand-700">{d.no || "(no number)"}</Link>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{qtyText(d.qtyTotal)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="truncate">{d.party || "—"}</span><span className="shrink-0 tabular-nums">{dayLabel(d.date)} · {(d.lines ?? []).length} item{(d.lines ?? []).length === 1 ? "" : "s"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The stock section of the dashboard: shown alone to stock users, below the quotation dashboard to admins. */
export default async function StockDashboard({ heading }: { heading: boolean }) {
  const d = await stockDashboard();
  const L = d.levels;
  return (
    <section aria-label="Stock">
      {heading && (
        <div className="mb-4 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-8">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Boxes className="h-5 w-5" strokeWidth={1.75} /></span><h2 className="text-lg font-semibold text-slate-900">Stock</h2></div>
          <div className="flex gap-2"><Link href="/stock/inward/new" className="btn-ghost">+ Inward entry</Link><Link href="/stock/outward/new" className="btn-ghost">+ Outward invoice</Link></div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Level label="Parts in the ledger" n={L.parts} sub={`${L.ok.toLocaleString("en-IN")} with more than ${LOW_STOCK} in stock`} tone="text-slate-900" href="/stock/ledger" />
        <Level label="Low stock" n={L.low} sub={`1 to ${LOW_STOCK} left`} tone="text-amber-600" href="/stock/ledger?level=low" />
        <Level label="Out of stock" n={L.out} sub="nothing left" tone="text-red-600" href="/stock/ledger?level=out" />
        <Level label="Negative balance" n={L.negative} sub={L.negative ? "sent out more than was recorded in – check" : "none"} tone={L.negative ? "text-red-700" : "text-slate-400"} href="/stock/ledger?level=negative" />
      </div>

      <div className="card mb-6 p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">Movement</h2><Link href="/stock/reports" className="text-sm font-medium text-brand-600 hover:text-brand-700">Reports</Link></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Movement label={`Today · ${dayLabel(d.today)}`} t={d.moves.today} />
          <Movement label="This month" t={d.moves.month} />
          <Movement label="This financial year" t={d.moves.year} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Docs title="Recent outward" icon={PackageMinus} tone="bg-red-50 text-red-600" rows={d.recentOut} path="/stock/outward" empty="No outward invoices yet." />
        <Docs title="Recent inward" icon={PackagePlus} tone="bg-emerald-50 text-emerald-600" rows={d.recentIn} path="/stock/inward" empty="No inward entries yet." />
        <div className="card overflow-hidden md:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><TriangleAlert className="h-5 w-5" strokeWidth={1.75} /></span>
              <div><h2 className="font-semibold text-slate-900">Running low</h2><div className="text-xs text-slate-500">{d.alerts.length ? "Dropped to low stock most recently" : "Low parts that went out most recently"}</div></div></div>
            <Link href="/stock/ledger?level=low" className="shrink-0 whitespace-nowrap text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>
          </div>
          {(d.alerts.length ? d.alerts : d.lowest).length === 0 ? <p className="px-5 py-6 text-sm text-slate-400">Nothing is running low.</p> : (
            <ul className="divide-y divide-slate-100">
              {(d.alerts.length ? d.alerts : d.lowest).map((a: any) => (
                <li key={a.pn} className="flex items-center gap-3 px-5 py-3">
                  <span className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm font-bold tabular-nums ${a.balance <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{qtyText(a.balance)}</span>
                  <div className="min-w-0 flex-1"><div className="truncate font-mono text-xs font-semibold text-slate-900">{a.pn}{a.location && <span className="ml-2 font-sans font-normal text-slate-400">{a.location}</span>}</div><div className="truncate text-sm text-slate-600">{a.desc || "—"}</div></div>
                  {a.last && <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">out {dayLabel(a.last)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
