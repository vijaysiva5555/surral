"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Copy, Trash2, FileSpreadsheet, Loader2, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";
import { dmy, inr0 } from "@/lib/format";
import type { QuoteCategory } from "@/lib/quoteCategory";

type B = { _id: string; name: string; date: string; code: string; updatedAt: string; createdByName?: string; summary: { count: number; landed: number; unit: number; price: number; marginPct: number } };

export default function BomClient({
  category,
  basePath,
  title,
  subtitle,
}: {
  category: QuoteCategory;
  basePath: string;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(""); const [items, setItems] = useState<B[] | null>(null); const [err, setErr] = useState("");
  const load = () => api(`/api/bom?category=${category}&q=${encodeURIComponent(q)}`).then((r) => setItems(r.items)).catch((e) => setErr(e.message));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  async function dup(b: B) { try { const r = await api(`/api/bom/${b._id}/clone`, { method: "POST" }); router.push(`${basePath}/${r.item._id}`); } catch (e) { setErr((e as Error).message); } }
  async function del(b: B) { if (confirm(`Delete BOM “${b.name}”?\nQuotations that already use it keep their own copy.`)) { await api(`/api/bom/${b._id}`, { method: "DELETE" }); load(); } }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle}>
        <Link href={`${basePath}/new`} className="btn-primary"><Plus className="h-4 w-4" />New BOM</Link>
      </PageHeader>
      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      <div className="card overflow-hidden">
        <div className="relative border-b border-slate-200 p-4"><Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search by BOM name, part number or item…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">BOM name</th><th className="th">Date</th><th className="th text-right">Items</th><th className="th text-right">Total landed ₹</th><th className="th text-right">Total unit price ₹</th><th className="th text-right">Margin</th><th className="th">Updated</th><th className="th w-28" /></tr></thead>
            <tbody>
              {!items && <tr><td colSpan={8} className="td text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
              {items?.length === 0 && <tr><td colSpan={8} className="td py-12 text-center text-slate-400"><Layers className="mx-auto mb-2 h-8 w-8" />No BOMs yet. Click <b>New BOM</b> and paste your Excel BOM sheet into the grid.</td></tr>}
              {items?.map((b) => (
                <tr key={b._id} className="hover:bg-slate-50">
                  <td className="td"><Link href={`${basePath}/${b._id}`} className="font-medium text-brand-700 hover:underline">{b.name}</Link><div className="text-xs text-slate-400">{b.createdByName}</div></td>
                  <td className="td whitespace-nowrap text-xs">{dmy(b.date)}</td>
                  <td className="td text-right tabular-nums">{b.summary.count}</td>
                  <td className="td text-right tabular-nums">{inr0(b.summary.landed)}</td>
                  <td className="td text-right font-semibold tabular-nums">{inr0(b.summary.price)}</td>
                  <td className="td text-right text-xs tabular-nums">{b.summary.marginPct.toFixed(1)}%</td>
                  <td className="td whitespace-nowrap text-xs text-slate-500">{dmy(b.updatedAt)}</td>
                  <td className="td whitespace-nowrap text-right">
                    <a title="Download Excel" href={`/api/bom/${b._id}/excel`} className="inline-block p-1.5 text-slate-500 hover:text-brand-600"><FileSpreadsheet className="h-4 w-4" /></a>
                    <button title="Duplicate" onClick={() => dup(b)} className="p-1.5 text-slate-500 hover:text-brand-600"><Copy className="h-4 w-4" /></button>
                    <button title="Delete" onClick={() => del(b)} className="p-1.5 text-slate-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
