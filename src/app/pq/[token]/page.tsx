/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { FileDown } from "lucide-react";
import { findSharedProject } from "@/lib/publicProjectQuote";
import { dmy } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Offer", robots: { index: false, follow: false } };

export default async function SharedProjectQuote({ params }: { params: { token: string } }) {
  const q: any = await findSharedProject(params.token, true);
  if (!q) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Link not available</h1>
          <p className="mt-2 text-sm text-slate-500">This offer link has expired or was switched off. Please contact the sender for a new copy.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{q.company?.name}</div>
          <h1 className="text-xl font-bold text-slate-900">Offer {q.number}</h1>
          <div className="text-sm text-slate-500">{q.customer?.name} · {dmy(q.date)}</div>
        </div>
        <a href={`/api/public/project/${params.token}/pdf`} className="btn-primary"><FileDown className="h-4 w-4" />Download PDF</a>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <iframe src={`/api/public/project/${params.token}/pdf?inline=1`} title={`Offer ${q.number}`} className="h-[80vh] w-full bg-white" />
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">If the offer does not appear above, use the download button.</p>
    </main>
  );
}
