"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, FileDown, Copy, Loader2, Download, ArrowLeft, CircleDot } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import QuoteStatusModal from "@/components/QuoteStatusModal";
import { api } from "@/lib/client";
import { displayNumber } from "@/lib/quoteCalc";
import { dmy, inr0 } from "@/lib/format";
import Pager from "@/components/Pager";
import { QUOTE_STATUSES, quoteStatusLabel } from "@/lib/quoteStatus";
import type { QuoteCategory } from "@/lib/quoteCategory";

type Q = { _id: string; number: string; revision: number; date: string; validUntil: string; status: string; customer?: { name: string }; totals?: { total: number }; referredBy?: string; createdBy?: string; createdByName?: string };

function canChangeQuoteStatus(role: "admin" | "sales" | "viewer", userId: string, q: Q) {
  if (role === "viewer" || q.status === "superseded") return false;
  if (role === "admin") return true;
  return role === "sales" && String(q.createdBy) === userId;
}

export default function QuotationsClient({
  role,
  userId,
  category,
  basePath,
  title,
  listSub,
}: {
  role: "admin" | "sales" | "viewer";
  userId: string;
  category: QuoteCategory;
  basePath: string;
  title: string;
  listSub: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId") ?? "";
  const customerName = searchParams.get("customer") ?? "";
  const forCustomer = Boolean(customerId);
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const [d, setD] = useState<{ items: Q[]; total: number; pages: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusQuote, setStatusQuote] = useState<Q | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { setPage(1); }, [q, status, customerId]);
  const load = () => api(`/api/quotes?category=${category}&q=${encodeURIComponent(q)}&status=${status}&customerId=${encodeURIComponent(customerId)}&page=${page}`).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status, customerId, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function duplicate(id: string) {
    setBusy(id);
    try { const r = await api(`/api/quotes/${id}/clone?mode=duplicate`, { method: "POST" }); router.push(`${basePath}/${r.item._id}`); } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }

  return (
    <>
      <PageHeader
        title={forCustomer && customerName ? `${title} – M/s. ${customerName}` : title}
        subtitle={d ? `${d.total.toLocaleString("en-IN")} quotation${d.total === 1 ? "" : "s"}${forCustomer ? " for this customer" : ""}` : ""}
      >
        {forCustomer && (
          <Link href="/customers" className="btn-ghost"><ArrowLeft className="h-4 w-4" />Customers</Link>
        )}
        <a className="btn-ghost" href={`/api/quotes/export?category=${category}&q=${encodeURIComponent(q)}&status=${status}${customerId ? `&customerId=${encodeURIComponent(customerId)}` : ""}`}><Download className="h-4 w-4" />Export Excel</a>
        {role !== "viewer" && <Link href={`${basePath}/new`} className="btn-primary"><Plus className="h-4 w-4" />New quotation</Link>}
      </PageHeader>
      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <div className="card-header-title">Quotation list</div>
            <div className="card-header-sub">{forCustomer ? "All quotations raised for this customer" : listSub}</div>
          </div>
        </div>
        <div className="table-toolbar">
          <div className="relative min-w-0 w-full flex-1 sm:min-w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search by quote number, customer or reference…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-full sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{QUOTE_STATUSES.map((s) => <option key={s} value={s}>{quoteStatusLabel(s)}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Quote #</th>{!forCustomer && <th className="th">Customer</th>}<th className="th">Date</th><th className="th">Valid until</th><th className="th text-right">Total (incl. GST)</th><th className="th">Status</th><th className="th w-32" /></tr></thead>
            <tbody>
              {!d && <tr><td colSpan={forCustomer ? 6 : 7} className="td text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
              {d?.items.length === 0 && <tr><td colSpan={forCustomer ? 6 : 7} className="td py-10 text-center text-slate-400">{forCustomer ? "No quotations for this customer yet." : "No quotations found."}</td></tr>}
              {d?.items.map((x) => {
                const overdue = x.status === "sent" && new Date(x.validUntil) < new Date();
                return (
                  <tr key={x._id} className="hover:bg-slate-50">
                    <td className="td"><Link href={`${basePath}/${x._id}`} className="font-medium text-brand-700 hover:underline">{displayNumber(x)}</Link><div className="text-xs text-slate-400">{x.createdByName}{x.referredBy && forCustomer ? ` · ${x.referredBy}` : ""}</div></td>
                    {!forCustomer && <td className="td">{x.customer?.name}<div className="text-xs text-slate-400">{x.referredBy}</div></td>}
                    <td className="td whitespace-nowrap text-xs">{dmy(x.date)}</td>
                    <td className={`td whitespace-nowrap text-xs ${overdue ? "font-medium text-red-600" : ""}`}>{dmy(x.validUntil)}{overdue && " · overdue"}</td>
                    <td className="td text-right font-medium tabular-nums">₹{inr0(x.totals?.total)}</td>
                    <td className="td"><StatusBadge status={x.status} /></td>
                    <td className="td whitespace-nowrap text-right">
                      {role !== "viewer" ? (
                        <a title="Open PDF" target="_blank" href={`/api/quotes/${x._id}/pdf?inline=1`} className="inline-block p-1.5 text-slate-500 hover:text-brand-600"><FileDown className="h-4 w-4" /></a>
                      ) : (
                        <span title="Viewers cannot download the PDF" className="inline-block p-1.5 text-slate-300"><FileDown className="h-4 w-4" /></span>
                      )}
                      {canChangeQuoteStatus(role, userId, x) && (
                        <button type="button" title="Change status" onClick={() => setStatusQuote(x)} className="p-1.5 text-slate-500 hover:text-brand-600">
                          <CircleDot className="h-4 w-4" />
                        </button>
                      )}
                      {role !== "viewer" && <button title="Duplicate" disabled={busy === x._id} onClick={() => duplicate(x._id)} className="p-1.5 text-slate-500 hover:text-brand-600">{busy === x._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {d && <Pager page={page} pages={d.pages} total={d.total} set={setPage} />}
      </div>
      {statusQuote && (
        <QuoteStatusModal
          quote={statusQuote}
          onClose={() => setStatusQuote(null)}
          onSaved={(status) => {
            setD((prev) =>
              prev
                ? { ...prev, items: prev.items.map((it) => (it._id === statusQuote._id ? { ...it, status } : it)) }
                : prev,
            );
          }}
        />
      )}
    </>
  );
}
