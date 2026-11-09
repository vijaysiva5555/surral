/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canEditQuote } from "@/lib/quoteAccess";
import { financialYear } from "@/lib/quoteCalc";
import { nextQuoteSeq } from "@/lib/nextNumber";
import { Quote } from "@/models/Quote";
import { Company } from "@/models/Company";
import { initialApprovalForRole } from "@/lib/quoteApproval";

/** ?mode=duplicate (new number) | revise (same number, Rev n+1; the old one becomes "superseded") */
export const POST = (req: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  const mode = req.nextUrl.searchParams.get("mode") === "revise" ? "revise" : "duplicate";
  await dbConnect();
  const src: any = await Quote.findById(params.id).lean();
  if (!src) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (mode === "revise" && !canEditQuote(session, src)) return NextResponse.json({ error: "You can only revise your own quotations" }, { status: 403 });

  const { _id, createdAt, updatedAt, __v, approvalStatus, approvalRequestedAt, approvalRequestedBy, approvalRequestedByName, approvedAt, approvedBy, approvedByName, approvalNote, shareToken, shareExpiresAt, shareViews, shareLastViewedAt, ...rest } = src;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T12:00:00Z");
  let fields: any;
  if (mode === "revise") {
    const last: any = await Quote.findOne({ seq: src.seq }).sort({ revision: -1 }).select("revision").lean();
    fields = { revision: (last?.revision ?? 0) + 1 };
    await Quote.updateOne({ _id: src._id }, { status: "superseded" });
  } else {
    const company: any = await Company.findOne().lean();
    const seq = await nextQuoteSeq(company?.quoteStartNo ?? 1);
    const fy = financialYear(today);
    fields = { seq, revision: 0, fy, number: `${company?.quotePrefix ?? src.company?.quotePrefix}/${seq}/${fy}` };
  }
  const approval = initialApprovalForRole(session.user.role);
  const doc = await Quote.create({
    ...rest, ...fields, status: "draft", date: today, validUntil: new Date(today.getTime() + (src.validityDays ?? 30) * 86400000),
    createdBy: session.user.id, createdByName: session.user.name, approvalStatus: approval,
    ...(approval === "approved" ? { approvedAt: new Date(), approvedBy: session.user.id, approvedByName: session.user.name } : {}),
  });
  await audit(session, mode, "quote", String(doc._id), `${mode === "revise" ? "Revised" : "Duplicated"} ${src.number} → ${doc.number}${doc.revision ? ` Rev ${doc.revision}` : ""}`);
  return NextResponse.json({ item: { _id: doc._id } }, { status: 201 });
});
