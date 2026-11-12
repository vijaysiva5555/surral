/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { quoteStatusLabel, quoteStatusPatchSchema } from "@/lib/quoteStatus";
import { offerImageKeys, projectQuoteInputSchema, projectTotals, snapProjectCustomer } from "@/lib/projectQuote";
import { deleteObjects } from "@/lib/s3";
import { ProjectQuote } from "@/models/ProjectQuote";
import { Customer } from "@/models/Customer";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

export const GET = (_: NextRequest, { params }: Ctx) => handle(async () => {
  await guard();
  await dbConnect();
  const q: any = await ProjectQuote.findById(params.id).lean();
  if (!q) return NextResponse.json({ error: "Project offer not found" }, { status: 404 });
  return NextResponse.json({ item: q });
});

export const PUT = (req: NextRequest, { params }: Ctx) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  const input = projectQuoteInputSchema.parse(await req.json());
  await dbConnect();
  const q: any = await ProjectQuote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Project offer not found" }, { status: 404 });
  if (session.user.role !== "admin" && q.createdBy !== session.user.id) {
    return NextResponse.json({ error: "You can only edit your own offers" }, { status: 403 });
  }

  let cu = q.customer;
  if (String(q.customerId) !== input.customerId) {
    const c = await Customer.findById(input.customerId).lean<any>();
    if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    cu = snapProjectCustomer(c, input.contact);
    q.customerId = c._id;
  } else {
    cu = { ...cu, contact: input.contact };
  }

  const oldImages = offerImageKeys(q.offers);
  q.set({
    ...input,
    date: new Date(input.date + "T12:00:00Z"),
    customer: cu,
    totals: projectTotals(input.offers, input.terms.find((t) => /tax/i.test(t.label))?.value || "GST 18% Extra"),
  });
  await q.save();
  const kept = new Set(offerImageKeys(input.offers));
  await deleteObjects(oldImages.filter((k) => !kept.has(k)));   // images removed from the offers
  await audit(session, "update", "projectQuote", params.id, `Edited project offer ${q.number}`);
  return NextResponse.json({ item: q });
});

export const PATCH = (req: NextRequest, { params }: Ctx) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  const { status } = z.object({ status: quoteStatusPatchSchema }).parse(await req.json());
  await dbConnect();
  const q: any = await ProjectQuote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Project offer not found" }, { status: 404 });
  if (session.user.role !== "admin" && q.createdBy !== session.user.id) {
    return NextResponse.json({ error: "You can only change your own offers" }, { status: 403 });
  }
  const old = q.status;
  q.status = status;
  await q.save();
  await audit(session, "status", "projectQuote", params.id, `${q.number}: ${quoteStatusLabel(old)} → ${quoteStatusLabel(status)}`);
  return NextResponse.json({ item: { _id: q._id, status } });
});

export const DELETE = (_: NextRequest, { params }: Ctx) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  await dbConnect();
  const q: any = await ProjectQuote.findById(params.id);
  if (!q) return NextResponse.json({ ok: true });
  if (session.user.role !== "admin" && !(q.createdBy === session.user.id && q.status === "draft")) {
    return NextResponse.json({ error: "Only admins can delete sent offers" }, { status: 403 });
  }
  await q.deleteOne();
  await deleteObjects(offerImageKeys(q.offers));
  await audit(session, "delete", "projectQuote", params.id, `Deleted project offer ${q.number}`);
  return NextResponse.json({ ok: true });
});
