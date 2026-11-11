/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Cog, Wrench, FolderKanban, TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { Customer } from "@/models/Customer";
import { PriceList } from "@/models/PriceList";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { displayNumber } from "@/lib/quoteCalc";
import { dmy, inr0 } from "@/lib/format";
import { expireOverdue } from "@/lib/expire";
import { QUOTE_STATUS_PIPELINE } from "@/lib/quoteStatus";
import {
  PERIODS, SECTIONS, SECTION_LABEL, SECTION_PATH, sectionStats, recentBySection, customerValues,
  type Section, type CustomerValue,
} from "@/lib/dashboard";

export const dynamic = "force-dynamic";

const LOOK: Record<Section, { icon: LucideIcon; chip: string; tile: string; bar: string }> = {
  equipment: { icon: Cog, chip: "bg-brand-50 text-brand-600", tile: "bg-brand-50/60", bar: "bg-brand-500" },
  spare: { icon: Wrench, chip: "bg-violet-50 text-violet-600", tile: "bg-violet-50/60", bar: "bg-violet-500" },
  project: { icon: FolderKanban, chip: "bg-emerald-50 text-emerald-600", tile: "bg-emerald-50/60", bar: "bg-emerald-500" },
};
const STATUS_BAR: Record<string, string> = {
  draft: "bg-slate-400", sent: "bg-brand-500", agree: "bg-emerald-500", rejected: "bg-red-500", expired: "bg-amber-500",
};
const money = (v: number) => `₹${inr0(v)}`;

function SectionTitle({ s, children }: { s: Section; children?: React.ReactNode }) {
  const { icon: Icon, chip } = LOOK[s];
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${chip}`}><Icon className="h-5 w-5" strokeWidth={1.75} /></span>
        <h2 className="font-semibold text-slate-900">{SECTION_LABEL[s]}</h2>
      </div>
      {children}
    </div>
  );
}

function CustomerList({ title, sub, rows, icon: Icon, tone }: { title: string; sub: string; rows: CustomerValue[]; icon: LucideIcon; tone: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" strokeWidth={1.75} /></span>
          <div><div className="card-header-title">{title}</div><div className="card-header-sub">{sub}</div></div>
        </div>
      </div>
      {rows.length === 0 ? <p className="px-5 py-6 text-sm text-slate-400">No customers to show yet.</p> : (
        <ol className="divide-y divide-slate-100">
          {rows.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className="w-5 shrink-0 text-xs font-semibold text-slate-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-800">{c.name}</div>
                <div className="text-xs text-slate-500">{c.n} quotation{c.n === 1 ? "" : "s"}{c.agreeV ? ` · ${money(c.agreeV)} agreed` : ""}</div>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">{money(c.v)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  await dbConnect();
  await expireOverdue();
  const now = new Date();

  const [stats, recent, cust, expiring, customers, lists] = await Promise.all([
    sectionStats(now),
    recentBySection(5),
    customerValues(5),
    Quote.find({ status: "sent", validUntil: { $lte: new Date(now.getTime() + 7 * 86400000) } }).sort({ validUntil: 1 }).limit(5)
      .select("number revision category validUntil customer.name totals.total").lean<any[]>(),
    Customer.countDocuments({ active: true }),
    PriceList.find().sort({ effectiveFrom: -1 }).limit(3).lean<any[]>(),
  ]);
  const canCreate = session?.user.role !== "viewer";

  return (
    <>
      <PageHeader title={`Welcome, ${session?.user.name?.split(" ")[0] ?? ""}`} subtitle="Surral Surface Coatings · Quotation Manager">
        {canCreate && SECTIONS.map((s) => (
          <Link key={s} href={`${SECTION_PATH[s]}/new`} className={s === "equipment" ? "btn-primary" : "btn-ghost"}>+ {SECTION_LABEL[s]} quotation</Link>
        ))}
      </PageHeader>

      {/* ---- quotation counts by period ---- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <div key={s} className="card p-5">
            <SectionTitle s={s}>
              <div className="text-right">
                <div className="text-xl font-bold tabular-nums text-slate-900">{stats[s].total.n}</div>
                <div className="text-[11px] text-slate-500">all time</div>
              </div>
            </SectionTitle>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {PERIODS.map(({ key, label }) => (
                <div key={key} className={`rounded-xl px-3 py-2.5 ${LOOK[s].tile}`}>
                  <div className="text-xs font-medium text-slate-500">{label}</div>
                  <div className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{stats[s].periods[key].n}</div>
                  <div className="truncate text-xs tabular-nums text-slate-500">{money(stats[s].periods[key].v)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ---- status breakdown ---- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {SECTIONS.map((s) => {
          const total = Math.max(stats[s].total.n, 1);
          return (
            <div key={s} className="card p-5">
              <SectionTitle s={s}><span className="text-xs text-slate-500">by status</span></SectionTitle>
              <ul className="mt-4 space-y-3">
                {QUOTE_STATUS_PIPELINE.map((k) => {
                  const t = stats[s].statuses[k];
                  return (
                    <li key={k}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <StatusBadge status={k} />
                        <span className="tabular-nums text-slate-500"><b className="text-slate-900">{t.n}</b> · {money(t.v)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${STATUS_BAR[k]}`} style={{ width: `${(t.n / total) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ---- recent quotations ---- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <div key={s} className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <SectionTitle s={s}><Link href={SECTION_PATH[s]} className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link></SectionTitle>
              <div className="mt-1 text-xs text-slate-500">Recent quotations</div>
            </div>
            {recent[s].length === 0 ? <p className="px-5 py-6 text-sm text-slate-400">No quotations yet.</p> : (
              <ul className="divide-y divide-slate-100">
                {recent[s].map((q) => (
                  <li key={String(q._id)} className="px-5 py-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`${SECTION_PATH[s]}/${q._id}`} className="truncate text-sm font-medium text-brand-700">{displayNumber(q)}</Link>
                      <StatusBadge status={q.status} />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">{q.customer?.name}</span>
                      <span className="shrink-0 tabular-nums">{dmy(q.date)} · {money(q.totals?.total ?? 0)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* ---- customers + follow-up ---- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <CustomerList title="High value customers" sub="Highest total quoted · all sections" rows={cust.high} icon={TrendingUp} tone="bg-emerald-50 text-emerald-600" />
        <CustomerList title="Low value customers" sub="Lowest total quoted · all sections" rows={cust.low} icon={TrendingDown} tone="bg-amber-50 text-amber-600" />
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Follow up – expiring soon</h2>
          {expiring.length === 0 ? <p className="text-sm text-slate-400">No sent quotations are about to expire.</p> : (
            <ul className="space-y-3 text-sm">{expiring.map((q) => (
              <li key={q._id}><Link href={`/${q.category === "equipment" ? "equipment" : "spare"}/quotations/${q._id}`} className="font-medium text-brand-700">{displayNumber(q)}</Link> · {q.customer?.name}
                <div className={`text-xs ${new Date(q.validUntil) < now ? "text-red-600" : "text-amber-600"}`}>{new Date(q.validUntil) < now ? "Expired" : "Valid until"} {dmy(q.validUntil)} · {money(q.totals?.total ?? 0)}</div></li>
            ))}</ul>
          )}
        </div>
      </div>

      <div className="card flex flex-col gap-2 p-4 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2">
        <span><b className="text-slate-800">{customers}</b> active customers</span>
        <span>Price lists: {lists.length ? lists.map((l: any) => <b key={l._id} className="mr-2 text-slate-800">{l.year}</b>) : <Link href="/pricing" className="font-medium text-brand-700">import one</Link>}</span>
      </div>
    </>
  );
}
