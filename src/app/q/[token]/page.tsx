/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import type { Metadata } from "next";
import { FileDown } from "lucide-react";
import { findShared, scrub } from "@/lib/publicQuote";
import { Company } from "@/models/Company";
import QuotePreview from "@/components/QuotePreview";
import { displayNumber } from "@/lib/quoteCalc";
import { fileSrc } from "@/lib/fileUrl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quotation", robots: { index: false, follow: false } };

export default async function SharedQuote({ params }: { params: { token: string } }) {
  const q = await findShared(params.token, true);
  if (!q) return (
    <main className="grid min-h-screen place-items-center p-6"><div className="card max-w-md p-8 text-center"><h1 className="text-xl font-bold text-slate-900">Link not available</h1><p className="mt-2 text-sm text-slate-500">This quotation link has expired or was switched off. Please contact the sender for a new copy.</p></div></main>
  );
  const co: any = await Company.findOne().select("logoData partnerLogoData").lean();
  const base = scrub(q);
  const doc = { ...base, images: (base.images ?? []).map((k: string) => fileSrc(k)), logo: fileSrc(co?.logoData), partnerLogo: fileSrc(co?.partnerLogoData) };
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-sm text-slate-500">{doc.company?.name}</div><h1 className="text-xl font-bold text-slate-900">Quotation {displayNumber(doc)}</h1></div>
        <a href={`/api/public/quotes/${params.token}/pdf`} target="_blank" className="btn-primary"><FileDown className="h-4 w-4" />Download PDF</a>
      </div>
      <div className="rounded-lg bg-slate-200 p-3"><QuotePreview q={doc} /></div>
    </main>
  );
}
