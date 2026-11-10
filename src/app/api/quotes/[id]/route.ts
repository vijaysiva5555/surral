/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canEditQuote } from "@/lib/quoteAccess";
import { quoteInputSchema } from "@/lib/schemas";
import { derive, snapCustomer } from "@/lib/quoteBuild";
import { Quote } from "@/models/Quote";
import { Customer } from "@/models/Customer";
import { expireOverdue } from "@/lib/expire";
import { learnHsn } from "@/lib/hsn";
import { learnParts } from "@/lib/learnParts";
import { quoteStatusLabel, quoteStatusPatchSchema } from "@/lib/quoteStatus";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

export const GET = (_: NextRequest, { params }: Ctx) => handle(async () => {
  const session = await guard();
  await dbConnect();
  await expireOverdue();
  const q: any = await Quote.findById(params.id).lean();
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (session.user.role === "viewer") q.lines = (q.lines ?? []).map(({ bom, costing, costPrice, ...l }: any) => l);   // landed costs and BOMs are for admin / sales only
  return NextResponse.json({ item: q });
});

export const PUT = (req: NextRequest, { params }: Ctx) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  const input = quoteInputSchema.parse(await req.json());
  await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (!canEditQuote(session, q)) return NextResponse.json({ error: "You can only edit your own quotations" }, { status: 403 });

  let cu = q.customer;
  if (String(q.customerId) !== input.customerId) {
    const c = await Customer.findById(input.customerId).lean<any>();
    if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    cu = snapCustomer(c, input.contact); q.customerId = c._id;
  } else cu = { ...cu, contact: input.contact };
  q.set({ ...derive(input, q.company, cu), customer: cu });
  await q.save();
  await Promise.all([learnHsn(input.lines), learnParts(input.lines)]);
  await audit(session, "update", "quote", params.id, `Edited ${q.number}${q.revision ? ` Rev ${q.revision}` : ""}`);
  return NextResponse.json({ item: q });
});

export const PATCH = (req: NextRequest, { params }: Ctx) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  const { status } = z.object({ status: quoteStatusPatchSchema }).parse(await req.json());
  await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (!canEditQuote(session, q)) return NextResponse.json({ error: "You can only change your own quotations" }, { status: 403 });
  const old = q.status; q.status = status; await q.save();
  await audit(session, "status", "quote", params.id, `${q.number}: ${quoteStatusLabel(old)} → ${quoteStatusLabel(status)}`);
  return NextResponse.json({ item: { _id: q._id, status } });
});

export const DELETE = (_: NextRequest, { params }: Ctx) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ ok: true });
  if (session.user.role !== "admin" && !(canEditQuote(session, q) && q.status === "draft")) return NextResponse.json({ error: "Only admins can delete sent quotations" }, { status: 403 });
  await q.deleteOne();
  await audit(session, "delete", "quote", params.id, `Deleted ${q.number}`);
  return NextResponse.json({ ok: true });
});
