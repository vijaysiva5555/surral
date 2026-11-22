/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowRight, Boxes, PackageMinus, PackagePlus, TriangleAlert } from "lucide-react";
import { stockDashboard, type MoveTally } from "@/lib/stockDashboard";
import { LOW_STOCK, dayLabel, qtyText } from "@/lib/stockCalc";

const big = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function CardHead({ title, sub, href, link = "View all" }: { title: string; sub?: string; href?: string; link?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <div className="min-w-0"><h2 className="font-semibold text-slate-900">{title}</h2>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>
      {href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">{link}<ArrowRight className="h-3.5 w-3.5" /></Link>}
    </div>
  );
}

/** The stock part of the dashboard: shown alone to stock users, below the quotation part to admins. */
export default async function StockDashboard({ heading, canIn, canOut }: { heading: boolean; canIn: boolean; canOut: boolean }) {
  const d = await stockDashboard();
  const L = d.levels;
  const levels: { label: string; n: number; sub: string; tone: string; href: string }[] = [
    { label: "Parts in the ledger", n: L.parts, sub: `${big(L.ok)} with more than ${LOW_STOCK}`, tone: "text-slate-900", href: "/stock/ledger" },
    { label: "Low stock", n: L.low, sub: `1 to ${LOW_STOCK} left`, tone: "text-amber-600", href: "/stock/ledger?level=low" },
    { label: "Out of stock", n: L.out, sub: "nothing left", tone: "text-red-600", href: "/stock/ledger?level=out" },
    { label: "Negative", n: L.negative, sub: L.negative ? "check these" : "none", tone: L.negative ? "text-red-700" : "text-slate-400", href: "/stock/ledger?level=negative" },
  ];
  const moves: [string, MoveTally][] = [["Today", d.moves.today], ["This month", d.moves.month], ["This FY", d.moves.year]];
  // the latest documents of both kinds, newest first
  const recent = [...d.recentOut.map((x) => ({ ...x, kind: "out" as const })), ...d.recentIn.map((x) => ({ ...x, kind: "in" as const }))]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 7);
  const low = d.alerts.length ? d.alerts : d.lowest;

  return (
    <section aria-label="Stock">
      {heading && (
        <div className="mb-4 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-8">
          <div className="flex items-center gap-3"><span className="chip-3d h-10 w-10 from-amber-400 to-amber-600 [--chip-shadow:rgba(217,119,6,0.4)]"><Boxes className="h-5 w-5" strokeWidth={1.75} /></span><h2 className="text-lg font-semibold text-slate-900">Stock</h2></div>
          <div className="flex gap-2">{canIn && <Link href="/stock/inward/new" className="btn-ghost">+ Inward entry</Link>}{canOut && <Link href="/stock/outward/new" className="btn-ghost">+ Outward invoice</Link>}</div>
        </div>
      )}

      {/* ---- stock levels in one strip ---- */}
      <div className="card-3d mb-6 grid grid-cols-2 divide-slate-100 lg:grid-cols-4 lg:divide-x">
        {levels.map((x) => (
          <Link key={x.label} href={x.href} className="group p-4 transition hover:bg-slate-50/70 sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-brand-700">{x.label}</div>
            <div className={`mt-1 text-3xl font-bold tabular-nums ${x.tone}`}>{x.n.toLocaleString("en-IN")}</div>
            <div className="mt-0.5 text-xs text-slate-500">{x.sub}</div>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---- movement ---- */}
        <div className="card-3d overflow-hidden">
          <CardHead title="Movement" sub="Quantities in and out" href="/stock/reports" link="Reports" />
          <table className="w-full !min-w-0">
            <thead><tr><th className="th">Period</th><th className="th text-right">Inward</th><th className="th text-right">Outward</th></tr></thead>
            <tbody>
              {moves.map(([label, t]) => (
                <tr key={label}>
                  <td className="td text-slate-700">{label}</td>
                  <td className="td text-right"><div className="font-semibold tabular-nums text-emerald-700">+{big(t.inQty)}</div><div className="text-xs text-slate-400">{t.inDocs} entr{t.inDocs === 1 ? "y" : "ies"}</div></td>
                  <td className="td text-right"><div className="font-semibold tabular-nums text-red-600">−{big(t.outQty)}</div><div className="text-xs text-slate-400">{t.outDocs} invoice{t.outDocs === 1 ? "" : "s"}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- running low ---- */}
        <div className="card-3d overflow-hidden">
          <CardHead title="Running low" sub={d.alerts.length ? "Dropped to low stock most recently" : "Low parts that went out most recently"} href="/stock/ledger?level=low" />
          {low.length === 0 ? <p className="px-5 py-6 text-sm text-slate-400">Nothing is running low.</p> : (
            <ul className="divide-y divide-slate-100">
              {low.slice(0, 6).map((a: any) => (
                <li key={a.pn} className="flex items-center gap-3 px-5 py-2.5">
                  <span className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm font-bold tabular-nums ${a.balance <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{qtyText(a.balance)}</span>
                  <div className="min-w-0 flex-1"><div className="truncate font-mono text-xs font-semibold text-slate-900">{a.pn}{a.location && <span className="ml-2 font-sans font-normal text-slate-400">{a.location}</span>}</div><div className="truncate text-sm text-slate-600">{a.desc || "—"}</div></div>
                  <TriangleAlert className={`h-4 w-4 shrink-0 ${a.balance <= 0 ? "text-red-500" : "text-amber-500"}`} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- recent documents ---- */}
        <div className="card-3d overflow-hidden">
          <CardHead title="Recent entries" sub="Inward entries and outward invoices" href="/stock/outward" />
          {recent.length === 0 ? <p className="px-5 py-6 text-sm text-slate-400">No entries yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {recent.map((x) => (
                <li key={`${x.kind}-${x._id}`} className="flex items-center gap-3 px-5 py-2.5">
                  {x.kind === "in" ? <PackagePlus className="h-4 w-4 shrink-0 text-emerald-600" /> : <PackageMinus className="h-4 w-4 shrink-0 text-red-500" />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/stock/${x.kind === "in" ? "inward" : "outward"}/${x._id}`} className="block truncate text-sm font-medium text-brand-700 hover:underline">{x.no || "(no number)"}</Link>
                    <div className="truncate text-xs text-slate-500">{x.party || "—"} · {dayLabel(x.date)}</div>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${x.kind === "in" ? "text-emerald-700" : "text-red-600"}`}>{x.kind === "in" ? "+" : "−"}{qtyText(x.qtyTotal)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
