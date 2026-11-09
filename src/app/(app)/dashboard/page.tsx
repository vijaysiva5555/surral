/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { Customer } from "@/models/Customer";
import { PriceList } from "@/models/PriceList";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";
import { IndianRupee, TrendingUp, Trophy, Percent } from "lucide-react";
import { displayNumber } from "@/lib/quoteCalc";
import { dmy, inr0 } from "@/lib/format";
import { expireOverdue } from "@/lib/expire";
import { QUOTE_STATUS_PIPELINE } from "@/lib/quoteStatus";

export const dynamic = "force-dynamic";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  await dbConnect();
  await expireOverdue();
  const now = new Date();
  const fyStart = new Date(Date.UTC(now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1, 3, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sixAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const live = { status: { $ne: "superseded" } };

  const [byStatus, month, fy, monthly, recent, expiring, topCust, customers, lists] = await Promise.all([
    Quote.aggregate([{ $match: { ...live, date: { $gte: fyStart } } }, { $group: { _id: "$status", n: { $sum: 1 }, v: { $sum: "$totals.total" } } }]),
    Quote.aggregate([{ $match: { ...live, date: { $gte: monthStart } } }, { $group: { _id: null, n: { $sum: 1 }, v: { $sum: "$totals.total" } } }]),
    Quote.aggregate([{ $match: { ...live, date: { $gte: fyStart } } }, { $group: { _id: null, n: { $sum: 1 }, v: { $sum: "$totals.total" } } }]),
    Quote.find({ ...live, date: { $gte: sixAgo } }).select("date totals.total").lean<any[]>(),
    Quote.find().sort({ createdAt: -1 }).limit(6).select("number revision date status customer.name totals.total").lean<any[]>(),
    Quote.find({ status: "sent", validUntil: { $lte: new Date(now.getTime() + 7 * 86400000) } }).sort({ validUntil: 1 }).limit(6).select("number revision validUntil customer.name totals.total").lean<any[]>(),
    Quote.aggregate([{ $match: { ...live, date: { $gte: fyStart } } }, { $group: { _id: "$customer.name", v: { $sum: "$totals.total" }, n: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 5 }]),
    Customer.countDocuments({ active: true }),
    PriceList.find().sort({ effectiveFrom: -1 }).limit(3).lean<any[]>(),
  ]);

  const st = (k: string) => byStatus.find((x: any) => x._id === k) ?? { n: 0, v: 0 };
  const decided = st("agree").n + st("rejected").n;
  const conv = decided ? Math.round((st("agree").n / decided) * 100) : null;
  const bars = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    const inMonth = monthly.filter((x: any) => { const t = new Date(x.date); return t.getUTCFullYear() === d.getUTCFullYear() && t.getUTCMonth() === d.getUTCMonth(); });
    return { label: MONTHS[d.getUTCMonth()], v: inMonth.reduce((s: number, x: any) => s + (x.totals?.total ?? 0), 0), n: inMonth.length };
  });
  const max = Math.max(...bars.map((b) => b.v), 1);
  const cards = [
    { label: "Quoted this month", value: `₹${inr0(month[0]?.v ?? 0)}`, sub: `${month[0]?.n ?? 0} quotations`, icon: IndianRupee, tone: "brand" as const },
    { label: "Quoted this financial year", value: `₹${inr0(fy[0]?.v ?? 0)}`, sub: `${fy[0]?.n ?? 0} quotations`, icon: TrendingUp, tone: "violet" as const },
    { label: "Agree this financial year", value: `₹${inr0(st("agree").v)}`, sub: `${st("agree").n} agree · ${st("rejected").n} rejected`, icon: Trophy, tone: "emerald" as const },
    { label: "Conversion rate", value: conv === null ? "—" : `${conv}%`, sub: conv === null ? "no agree/rejected quotes yet" : "agree ÷ (agree + rejected)", icon: Percent, tone: "amber" as const },
  ];

  return (
    <>
      <PageHeader title={`Welcome, ${session?.user.name?.split(" ")[0] ?? ""}`} subtitle="Surral Surface Coatings · Quotation Manager">
        {session?.user.role !== "viewer" && <Link href="/quotations/new" className="btn-primary">+ New quotation</Link>}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} icon={c.icon} tone={c.tone} />
        ))}
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-4 sm:p-6 xl:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Quoted value – last 6 months</h2>
          <div className="flex h-36 items-end gap-1.5 sm:h-44 sm:gap-3">
            {bars.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${b.n} quotations · ₹${inr0(b.v)}`}>
                <div className="text-[10px] text-slate-400">{b.v ? `${(b.v / 100000).toFixed(1)}L` : ""}</div>
                <div className="w-full rounded-t-md bg-brand-500" style={{ height: `${Math.max((b.v / max) * 120, b.v ? 4 : 1)}px`, opacity: b.v ? 1 : 0.2 }} />
                <div className="text-xs text-slate-500">{b.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4 sm:p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Pipeline (this FY)</h2>
          <ul className="space-y-2.5 text-sm">
            {QUOTE_STATUS_PIPELINE.map((k) => (
              <li key={k} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><StatusBadge status={k} /><span className="text-right text-slate-500">{st(k).n} · ₹{inr0(st(k).v)}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="card-header">
            <div>
              <div className="card-header-title">Recent quotations</div>
              <div className="card-header-sub">Latest activity across your pipeline</div>
            </div>
            <Link href="/quotations" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full"><tbody>
              {recent.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-slate-400">No quotations yet.</td></tr>}
              {recent.map((q) => (
                <tr key={q._id} className="hover:bg-slate-50">
                  <td className="td min-w-[9rem]">
                    <Link href={`/quotations/${q._id}`} className="font-medium text-brand-700">{displayNumber(q)}</Link>
                    <div className="text-xs text-slate-500">{q.customer?.name}</div>
                    <div className="text-xs text-slate-400 sm:hidden">{dmy(q.date)} · ₹{inr0(q.totals?.total)}</div>
                  </td>
                  <td className="td hidden text-xs text-slate-500 sm:table-cell">{dmy(q.date)}</td>
                  <td className="td hidden text-right tabular-nums sm:table-cell">₹{inr0(q.totals?.total)}</td>
                  <td className="td"><StatusBadge status={q.status} /></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Follow up – expiring soon</h2>
            {expiring.length === 0 ? <p className="text-sm text-slate-400">No sent quotations are about to expire.</p> : (
              <ul className="space-y-3 text-sm">{expiring.map((q) => (
                <li key={q._id}><Link href={`/quotations/${q._id}`} className="font-medium text-brand-700">{displayNumber(q)}</Link> · {q.customer?.name}
                  <div className={`text-xs ${new Date(q.validUntil) < now ? "text-red-600" : "text-amber-600"}`}>{new Date(q.validUntil) < now ? "Expired" : "Valid until"} {dmy(q.validUntil)} · ₹{inr0(q.totals?.total)}</div></li>
              ))}</ul>
            )}
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Top customers (this FY)</h2>
            {topCust.length === 0 ? <p className="text-sm text-slate-400">Nothing quoted yet.</p> : (
              <ul className="space-y-2 text-sm">{topCust.map((c: any) => <li key={c._id} className="flex justify-between gap-3"><span className="truncate">{c._id}</span><span className="shrink-0 tabular-nums text-slate-500">₹{inr0(c.v)}</span></li>)}</ul>
            )}
          </div>
        </div>
      </div>

      <div className="card flex flex-col gap-2 p-4 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2">
        <span><b className="text-slate-800">{customers}</b> active customers</span>
        <span>Price lists: {lists.length ? lists.map((l: any) => <b key={l._id} className="mr-2 text-slate-800">{l.year}</b>) : <Link href="/pricing" className="font-medium text-brand-700">import one</Link>}</span>
      </div>
    </>
  );
}
