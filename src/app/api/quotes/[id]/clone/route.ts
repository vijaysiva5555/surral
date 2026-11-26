/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { quotePage } from "@/lib/pageAccess";
import { audit } from "@/lib/audit";
import { change } from "@/lib/auditDiff";
import { quoteStatusLabel } from "@/lib/quoteStatus";
import { canEditQuote } from "@/lib/quoteAccess";
import { financialYear } from "@/lib/quoteCalc";
import { nextQuoteSeq } from "@/lib/nextNumber";
import { nextFreeNumber } from "@/lib/quoteNumber";
import { formatQuoteNumber, parseQuoteCategory, quotePrefixFor, quoteStartNo, type QuoteCategory } from "@/lib/quoteCategory";
import { Quote } from "@/models/Quote";
import { Company } from "@/models/Company";

/** ?mode=duplicate (new number) | revise (same number, Rev n+1; the old one becomes "superseded") */
export const POST = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  await guardAccess(["equipmentQuotes", "spareQuotes"]);
  const mode = req.nextUrl.searchParams.get("mode") === "revise" ? "revise" : "duplicate";
  await dbConnect();
  const src: any = await Quote.findById(params.id).lean();
  const session = await guardAccess(quotePage(src?.category));
  if (!src) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (mode === "revise" && !canEditQuote(session, src)) return NextResponse.json({ error: "You can only revise your own quotations" }, { status: 403 });

  const { _id, createdAt, updatedAt, __v, shareToken, shareExpiresAt, shareViews, shareLastViewedAt, ...rest } = src;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T12:00:00Z");
  let fields: any;
  const category: QuoteCategory = parseQuoteCategory(src.category);
  if (mode === "revise") {
    const last: any = await Quote.findOne({ category, seq: src.seq }).sort({ revision: -1 }).select("revision").lean();
    fields = { revision: (last?.revision ?? 0) + 1 };
    await Quote.updateOne({ _id: src._id }, { status: "superseded" });
  } else {
    const company: any = await Company.findOne().lean();
    const fy = financialYear(today);
    const prefix = quotePrefixFor(company, category);
    const { seq, number } = await nextFreeNumber(() => nextQuoteSeq(quoteStartNo(company, category), category), (s) => formatQuoteNumber(prefix, s, fy, category));
    fields = { seq, revision: 0, fy, number };
  }
  const doc = await Quote.create({
    ...rest, ...fields, status: "draft", date: today, validUntil: new Date(today.getTime() + (src.validityDays ?? 30) * 86400000),
    createdBy: session.user.id, createdByName: session.user.name,
  });
  if (mode === "revise" && src.status !== "superseded") await audit(session, "status", "quote", params.id, `${src.number}${src.revision ? ` Rev ${src.revision}` : ""}: ${quoteStatusLabel(src.status)} → Superseded (revised)`, change("Status", src.status, "superseded", "status"));
  await audit(session, mode, "quote", String(doc._id), `${mode === "revise" ? "Revised" : "Duplicated"} ${src.number} → ${doc.number}${doc.revision ? ` Rev ${doc.revision}` : ""}`);
  return NextResponse.json({ item: { _id: doc._id } }, { status: 201 });
});
