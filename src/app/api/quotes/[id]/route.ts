/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { change, diffChanges, snap } from "@/lib/auditDiff";
import { canEditQuote } from "@/lib/quoteAccess";
import { quoteInputSchema } from "@/lib/schemas";
import { derive, snapCustomer } from "@/lib/quoteBuild";
import { Quote } from "@/models/Quote";
import { Customer } from "@/models/Customer";
import { PriceList } from "@/models/PriceList";
import { expireOverdue } from "@/lib/expire";
import { learnHsn } from "@/lib/hsn";
import { learnParts } from "@/lib/learnParts";
import { quoteStatusLabel, quoteStatusPatchSchema } from "@/lib/quoteStatus";
import { releaseQuoteImages } from "@/lib/quoteImages";
import { canSell } from "@/lib/roles";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = (_: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  const session = await guard();
  await dbConnect();
  await expireOverdue();
  const q: any = await Quote.findById(params.id).lean();
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (!canSell(session.user.role)) q.lines = (q.lines ?? []).map(({ bom, costing, costPrice, ...l }: any) => l);   // landed costs and BOMs are for admin / sales only
  return NextResponse.json({ item: q });
});

export const PUT = (req: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  const session = await guard(["admin", "sales"]);
  const input = quoteInputSchema.parse(await req.json());
  await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (!canEditQuote(session, q)) return NextResponse.json({ error: "You can only edit your own quotations" }, { status: 403 });

  const before = snap(q);
  let cu = q.customer;
  if (String(q.customerId) !== input.customerId) {
    const c = await Customer.findById(input.customerId).lean<any>();
    if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    cu = snapCustomer(c, input.contact); q.customerId = c._id;
  } else cu = { ...cu, contact: input.contact };
  const oldImages: string[] = [...(q.images ?? [])];
  q.set({ ...derive(input, q.company, cu), customer: cu });
  await q.save();
  await releaseQuoteImages(oldImages.filter((k) => !input.images.includes(k)), q._id);   // photos removed in this edit
  await Promise.all([learnHsn(input.lines), learnParts(input.lines)]);
  const changes = diffChanges(before, q);
  const [plOld, plNew] = [before.priceListId, q.priceListId].map((v) => (v ? String(v) : ""));
  if (plOld !== plNew) {   // the quotation stores only the id of its price list
    const pls = await PriceList.find({ _id: { $in: [plOld, plNew].filter(Boolean) } }).select("name").lean<any[]>().catch(() => [] as any[]);
    const name = (id: string) => (id ? pls.find((p) => String(p._id) === id)?.name ?? "(deleted price list)" : "");
    changes.unshift(...change("Price list", name(plOld), name(plNew)));
  }
  await audit(session, "update", "quote", params.id, `Edited ${q.number}${q.revision ? ` Rev ${q.revision}` : ""}`, changes);
  return NextResponse.json({ item: q });
});

export const PATCH = (req: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  const session = await guard(["admin", "sales"]);
  const { status } = z.object({ status: quoteStatusPatchSchema }).parse(await req.json());
  await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (!canEditQuote(session, q)) return NextResponse.json({ error: "You can only change your own quotations" }, { status: 403 });
  const old = q.status; q.status = status; await q.save();
  await audit(session, "status", "quote", params.id, `${q.number}: ${quoteStatusLabel(old)} → ${quoteStatusLabel(status)}`, change("Status", old, status, "status"));
  return NextResponse.json({ item: { _id: q._id, status } });
});

export const DELETE = (_: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  const session = await guard(["admin", "sales"]);
  await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ ok: true });
  if (session.user.role !== "admin" && !(canEditQuote(session, q) && q.status === "draft")) return NextResponse.json({ error: "Only admins can delete sent quotations" }, { status: 403 });
  await q.deleteOne();
  await releaseQuoteImages(q.images ?? [], q._id);
  await audit(session, "delete", "quote", params.id, `Deleted ${q.number}${q.revision ? ` Rev ${q.revision}` : ""}`, diffChanges(q, null, { only: ["customer.name", "date", "status", "totals.total"] }));
  return NextResponse.json({ ok: true });
});
