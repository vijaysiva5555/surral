import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { diffChanges } from "@/lib/auditDiff";
import { Customer } from "@/models/Customer";
import { stateFromGstin } from "@/lib/india";
import { customerSchema } from "@/lib/schemas";

export const GET = (_: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  await guard();
  await dbConnect();
  const doc = await Customer.findById(params.id).lean();
  if (!doc) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  return NextResponse.json({ item: doc });
});

export const PUT = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  const session = await guard(["admin", "sales"]);
  const data = customerSchema.parse(await req.json());
  await dbConnect();
  if (data.gstin) {
    const dup = await Customer.findOne({ gstin: data.gstin, _id: { $ne: params.id } }).select("name").lean<{ name: string }>();
    if (dup) return NextResponse.json({ error: `Another customer already uses this GST number: ${dup.name}` }, { status: 409 });
  }
  const before = await Customer.findById(params.id).lean();
  const doc = await Customer.findByIdAndUpdate(params.id, { ...data, ...stateFromGstin(data.gstin) }, { new: true });
  if (!doc) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  await audit(session, "update", "customer", params.id, `Edited customer ${doc.name}`, diffChanges(before, doc));
  return NextResponse.json({ item: doc });
});

export const DELETE = (_: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  const session = await guard(["admin"]);
  await dbConnect();
  const doc = await Customer.findByIdAndDelete(params.id);
  if (doc) await audit(session, "delete", "customer", params.id, `Deleted customer ${doc.name}`, diffChanges(doc, null, { only: ["gstin", "state", "addressLines"] }));
  return NextResponse.json({ ok: true });
});
