/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canEditQuote } from "@/lib/quoteAccess";
import { Quote } from "@/models/Quote";

type Ctx = { params: { id: string } };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request") }),
  z.object({ action: z.literal("approve"), note: z.string().trim().optional() }),
  z.object({ action: z.literal("reject"), note: z.string().trim().min(1, "Add a short reason for rejection") }),
]);

export const POST = (req: NextRequest, { params }: Ctx) => handle(async () => {
  const body = schema.parse(await req.json());
  await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

  if (body.action === "request") {
    const session = await guard(["admin", "sales"]);
    if (!canEditQuote(session, q)) return NextResponse.json({ error: "You can only request approval for your own quotations" }, { status: 403 });
    if (session.user.role === "admin") return NextResponse.json({ error: "Administrators do not need approval." }, { status: 400 });
    const st = q.approvalStatus ?? "none";
    if (st === "pending") return NextResponse.json({ error: "Approval has already been requested." }, { status: 400 });
    if (st === "approved") return NextResponse.json({ error: "This quotation is already approved." }, { status: 400 });
    q.approvalStatus = "pending";
    q.approvalRequestedAt = new Date();
    q.approvalRequestedBy = session.user.id;
    q.approvalRequestedByName = session.user.name;
    q.approvalNote = undefined;
    q.approvedAt = undefined;
    q.approvedBy = undefined;
    q.approvedByName = undefined;
    await q.save();
    await audit(session, "approval_request", "quote", params.id, `Requested admin approval for ${q.number}`);
    return NextResponse.json({ item: { _id: q._id, approvalStatus: q.approvalStatus, approvalRequestedAt: q.approvalRequestedAt } });
  }

  const session = await guard(["admin"]);
  const st = q.approvalStatus ?? "none";
  if (body.action === "approve") {
    if (st === "approved") return NextResponse.json({ error: "This quotation is already approved." }, { status: 400 });
    q.approvalStatus = "approved";
    q.approvedAt = new Date();
    q.approvedBy = session.user.id;
    q.approvedByName = session.user.name;
    q.approvalNote = body.note || undefined;
  } else {
    if (st !== "pending") return NextResponse.json({ error: "This quotation is not waiting for approval." }, { status: 400 });
    q.approvalStatus = "rejected";
    q.approvedAt = new Date();
    q.approvedBy = session.user.id;
    q.approvedByName = session.user.name;
    q.approvalNote = body.note;
  }
  await q.save();
  await audit(session, body.action === "approve" ? "approval_grant" : "approval_reject", "quote", params.id, `${body.action === "approve" ? "Approved" : "Rejected"} ${q.number}${body.note ? `: ${body.note}` : ""}`);
  return NextResponse.json({ item: { _id: q._id, approvalStatus: q.approvalStatus, approvalNote: q.approvalNote, approvedAt: q.approvedAt, approvedByName: q.approvedByName } });
});
