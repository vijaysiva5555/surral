/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowRight, BellRing, CalendarRange, CheckCircle2, Cog, FileText, FolderKanban, Send, Trophy, Users, Wrench, type LucideIcon } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { Customer } from "@/models/Customer";
import { PriceList } from "@/models/PriceList";
import DashboardHero from "@/components/DashboardHero";
import StatusBadge from "@/components/StatusBadge";
import { displayNumber } from "@/lib/quoteCalc";
import { dmy, inr0 } from "@/lib/format";
import { expireOverdue } from "@/lib/expire";
import { QUOTE_STATUS_PIPELINE, quoteStatusLabel } from "@/lib/quoteStatus";
import { PERIODS, SECTIONS, SECTION_LABEL, SECTION_PATH, sectionStats, recentBySection, customerValues, type Section } from "@/lib/dashboard";
import { sessionPerms } from "@/lib/serverAccess";
import StockDashboard from "./StockDashboard";

export const dynamic = "force-dynamic";

const SECTION_ICON: Record<Section, LucideIcon> = { equipment: Cog, spare: Wrench, project: FolderKanban };
const SECTION_DOT: Record<Section, string> = { equipment: "bg-brand-500", spare: "bg-violet-500", project: "bg-emerald-500" };
const STATUS_BAR: Record<string, string> = { draft: "bg-slate-400", sent: "bg-brand-500", agree: "bg-emerald-500", rejected: "bg-red-500", expired: "bg-amber-500" };
const money = (v: number) => `₹${inr0(v)}`;
/** ₹1.2 Cr / ₹4.5 L / ₹12,300 – short enough for a tile */
const short = (v: number) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : money(v));

/** a small headline number with its label */
function Kpi({ icon: Icon, label, value, sub, chip }: { icon: LucideIcon; label: string; value: string; sub: string; chip: string }) {
  return (
    <div className="card-3d flex items-center gap-4 p-4">
      <span className={`chip-3d h-11 w-11 ${chip}`}><Icon className="h-5 w-5" strokeWidth={1.75} /></span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="truncate text-xl font-bold tabular-nums text-slate-900">{value}</div>
        <div className="truncate text-xs text-slate-500">{sub}</div>
      </div>
    </div>
  );
}

function CardHead({ title, sub, href, link = "View all" }: { title: string; sub?: string; href?: string; link?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <div className="min-w-0"><h2 className="font-semibold text-slate-900">{title}</h2>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>
      {href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">{link}<ArrowRight className="h-3.5 w-3.5" /></Link>}
    </div>
  );
}

/** Who sees what follows Administration → Page access: the quotation half for whoever may open a quotation page, the
    stock half for whoever may open the ledger – an admin sees both. */
export default async function Dashboard() {
  const { session, can } = await sessionPerms();
  await dbConnect();
  const visible = SECTIONS.filter((s) => can(s === "equipment" ? "equipmentQuotes" : s === "spare" ? "spareQuotes" : "projectQuotes"));
  // each part goes to the people who work in it: whoever edits quotations gets the quotation part, whoever edits stock
  // gets the stock part (an admin both); a read-only user gets the quotation part, or the stock part when that is all they can see
  const editsQuotes = can("equipmentQuotes", "edit") || can("spareQuotes", "edit") || can("projectQuotes", "edit");
  const editsStock = can("stockInward", "edit") || can("stockOutward", "edit") || can("stockLedger", "edit");
  const sales = visible.length > 0 && (editsQuotes || !editsStock);
  const stock = can("stockLedger") && (editsStock || !sales);
  const newQuote = { equipment: can("equipmentQuotes", "edit"), spare: can("spareQuotes", "edit"), project: can("projectQuotes", "edit") };
  return (
    <>
      <DashboardHero title={`Welcome, ${session.user.name?.split(" ")[0] ?? ""}`} subtitle={`Surral Surface Coatings · ${sales && stock ? "Quotations & stock" : sales ? "Quotation Manager" : "Stock"}`}>
        {sales && SECTIONS.filter((s) => newQuote[s]).map((s) => (
          <Link key={s} href={`${SECTION_PATH[s]}/new`} className={s === "equipment" ? "btn-primary" : "btn-ghost"}>+ {SECTION_LABEL[s]} quotation</Link>
        ))}
        {!sales && can("stockInward", "edit") && <Link href="/stock/inward/new" className="btn-ghost">+ Inward entry</Link>}
        {!sales && can("stockOutward", "edit") && <Link href="/stock/outward/new" className="btn-primary">+ Outward invoice</Link>}
      </DashboardHero>
      {sales && <SalesDashboard sections={visible} />}
      {stock && <StockDashboard heading={sales} canIn={can("stockInward", "edit")} canOut={can("stockOutward", "edit")} />}
    </>
  );
}

async function SalesDashboard({ sections }: { sections: Section[] }) {
  await expireOverdue();
  const now = new Date();
  const [stats, recent, cust, expiring, customers, lists] = await Promise.all([
    sectionStats(now),
    recentBySection(6),
    customerValues(5),
    Quote.find({ status: "sent", validUntil: { $lte: new Date(now.getTime() + 7 * 86400000) } }).sort({ validUntil: 1 }).limit(5)
      .select("number revision category validUntil customer.name totals.total").lean<any[]>(),
    Customer.countDocuments({ active: true }),
    PriceList.find().sort({ effectiveFrom: -1 }).limit(3).select("year").lean<any[]>(),
  ]);

  // totals over the sections this user may see
  const sum = (pick: (s: Section) => { n: number; v: number }) => sections.reduce((t, s) => ({ n: t.n + pick(s).n, v: t.v + pick(s).v }), { n: 0, v: 0 });
  const month = sum((s) => stats[s].periods.month), all = sum((s) => stats[s].total);
  const status = Object.fromEntries(QUOTE_STATUS_PIPELINE.map((k) => [k, sum((s) => stats[s].statuses[k])])) as Record<string, { n: number; v: number }>;
  const decided = status.agree.n + status.rejected.n + status.expired.n;
  const winRate = decided ? Math.round((status.agree.n / decided) * 100) : null;

  const recentAll = sections.flatMap((s) => recent[s].map((q) => ({ ...q, section: s })))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8);

  return (
    <>
      {/* ---- headline numbers ---- */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={CalendarRange} label="Quoted this month" value={short(month.v)} sub={`${month.n} quotation${month.n === 1 ? "" : "s"}`} chip="from-sky-400 to-brand-600" />
        <Kpi icon={Send} label="Awaiting reply" value={short(status.sent.v)} sub={`${status.sent.n} sent`} chip="from-indigo-400 to-indigo-600 [--chip-shadow:rgba(79,70,229,0.4)]" />
        <Kpi icon={CheckCircle2} label="Agreed" value={short(status.agree.v)} sub={`${status.agree.n} quotation${status.agree.n === 1 ? "" : "s"}`} chip="from-emerald-400 to-emerald-600 [--chip-shadow:rgba(5,150,105,0.4)]" />
        <Kpi icon={Trophy} label="Win rate" value={winRate === null ? "—" : `${winRate}%`} sub={decided ? `${status.agree.n} of ${decided} decided` : "No decisions yet"} chip="from-amber-400 to-amber-600 [--chip-shadow:rgba(217,119,6,0.4)]" />
      </div>

      {/* ---- by section and by status ---- */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card-3d overflow-hidden lg:col-span-2">
          <CardHead title="Quotations by section" sub="Count and value quoted in each period" />
          <div className="table-scroll">
            <table className="w-full !min-w-[34rem]">
              <thead><tr><th className="th">Section</th>{PERIODS.map((p) => <th key={p.key} className="th text-right">{p.label}</th>)}<th className="th text-right">All time</th></tr></thead>
              <tbody>
                {sections.map((s) => {
                  const Icon = SECTION_ICON[s];
                  return (
                    <tr key={s} className="hover:bg-slate-50/70">
                      <td className="td"><Link href={SECTION_PATH[s]} className="flex items-center gap-2 font-medium text-slate-800 hover:text-brand-700"><Icon className="h-4 w-4 text-slate-400" />{SECTION_LABEL[s]}</Link></td>
                      {PERIODS.map((p) => { const t = stats[s].periods[p.key]; return <td key={p.key} className="td text-right"><div className="font-semibold tabular-nums text-slate-900">{t.n}</div><div className="text-xs tabular-nums text-slate-400">{t.n ? short(t.v) : "—"}</div></td>; })}
                      <td className="td text-right"><div className="font-semibold tabular-nums text-slate-900">{stats[s].total.n}</div><div className="text-xs tabular-nums text-slate-400">{stats[s].total.n ? short(stats[s].total.v) : "—"}</div></td>
                    </tr>
                  );
                })}
              </tbody>
              {sections.length > 1 && (
                <tfoot><tr className="bg-slate-50/70">
                  <td className="td font-semibold text-slate-700">Total</td>
                  {PERIODS.map((p) => { const t = sum((s) => stats[s].periods[p.key]); return <td key={p.key} className="td text-right"><div className="font-bold tabular-nums text-slate-900">{t.n}</div><div className="text-xs tabular-nums text-slate-500">{t.n ? short(t.v) : "—"}</div></td>; })}
                  <td className="td text-right"><div className="font-bold tabular-nums text-slate-900">{all.n}</div><div className="text-xs tabular-nums text-slate-500">{all.n ? short(all.v) : "—"}</div></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="card-3d overflow-hidden">
          <CardHead title="Pipeline" sub={`All ${all.n} quotation${all.n === 1 ? "" : "s"} by status`} />
          <div className="p-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]">
              {QUOTE_STATUS_PIPELINE.map((k) => status[k].n > 0 && <div key={k} className={`${STATUS_BAR[k]} h-full`} style={{ width: `${(status[k].n / Math.max(all.n, 1)) * 100}%` }} title={`${quoteStatusLabel(k)}: ${status[k].n}`} />)}
            </div>
            <ul className="mt-4 space-y-2.5">
              {QUOTE_STATUS_PIPELINE.map((k) => (
                <li key={k} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_BAR[k]}`} /><span className="text-slate-700">{quoteStatusLabel(k)}</span></span>
                  <span className="tabular-nums text-slate-500"><b className="text-slate-900">{status[k].n}</b> · {short(status[k].v)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ---- recent, follow-up, customers ---- */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card-3d overflow-hidden lg:col-span-2">
          <CardHead title="Recent quotations" sub="Newest across all sections" />
          {recentAll.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">No quotations yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {recentAll.map((q) => (
                <li key={`${q.section}-${q._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${SECTION_DOT[q.section]}`} title={SECTION_LABEL[q.section]} />
                  <div className="min-w-0 flex-1">
                    <Link href={`${SECTION_PATH[q.section]}/${q._id}`} className="block truncate text-sm font-medium text-brand-700 hover:underline">{displayNumber(q)}</Link>
                    <div className="truncate text-xs text-slate-500">{q.customer?.name ?? "—"} · {SECTION_LABEL[q.section]}</div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block"><div className="text-sm font-semibold tabular-nums text-slate-900">{money(q.totals?.total ?? 0)}</div><div className="text-xs text-slate-400">{dmy(q.date)}</div></div>
                  <StatusBadge status={q.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div className="card-3d overflow-hidden">
            <CardHead title="Follow up" sub="Sent quotations expiring within 7 days" />
            {expiring.length === 0 ? <p className="flex items-center gap-2 px-5 py-5 text-sm text-slate-400"><BellRing className="h-4 w-4" />Nothing to chase right now.</p> : (
              <ul className="divide-y divide-slate-100">
                {expiring.map((q) => {
                  const late = new Date(q.validUntil) < now;
                  return (
                    <li key={q._id} className="px-5 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2"><Link href={`/${q.category === "equipment" ? "equipment" : "spare"}/quotations/${q._id}`} className="truncate font-medium text-brand-700 hover:underline">{displayNumber(q)}</Link><span className="shrink-0 tabular-nums text-slate-700">{money(q.totals?.total ?? 0)}</span></div>
                      <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-slate-500">{q.customer?.name}</span><span className={`shrink-0 ${late ? "font-semibold text-red-600" : "text-amber-600"}`}>{late ? "Expired" : "Until"} {dmy(q.validUntil)}</span></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card-3d overflow-hidden">
            <CardHead title="Top customers" sub="By total value quoted" href="/customers" />
            {cust.high.length === 0 ? <p className="px-5 py-5 text-sm text-slate-400">No customers to show yet.</p> : (
              <ol className="divide-y divide-slate-100">
                {cust.high.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{i + 1}</span>
                    <div className="min-w-0 flex-1"><div className="truncate font-medium text-slate-800">{c.name}</div><div className="text-xs text-slate-500">{c.n} quotation{c.n === 1 ? "" : "s"}{c.agreeV ? ` · ${short(c.agreeV)} agreed` : ""}</div></div>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{short(c.v)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <div className="card-3d mb-2 flex flex-col gap-2 px-5 py-3 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
        <span className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" /><b className="text-slate-800">{customers}</b> active customers</span>
        <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" />Price lists: {lists.length ? lists.map((l: any) => <b key={l._id} className="text-slate-800">{l.year}</b>).reduce((a: any[], b, i) => (i ? [...a, ", ", b] : [b]), []) : <Link href="/pricing" className="font-medium text-brand-700">import one</Link>}</span>
      </div>
    </>
  );
}
