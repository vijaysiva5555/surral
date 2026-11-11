import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { Customer } from "@/models/Customer";
import { stateFromGstin } from "@/lib/india";
import { customerSchema } from "@/lib/schemas";

export const GET = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  await guard();
  await dbConnect();
  const doc = await Customer.findById(params.id).lean();
  if (!doc) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  return NextResponse.json({ item: doc });
});

export const PUT = (req: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  await guard(["admin", "sales"]);
  const data = customerSchema.parse(await req.json());
  await dbConnect();
  if (data.gstin) {
    const dup = await Customer.findOne({ gstin: data.gstin, _id: { $ne: params.id } }).select("name").lean<{ name: string }>();
    if (dup) return NextResponse.json({ error: `Another customer already uses this GST number: ${dup.name}` }, { status: 409 });
  }
  const doc = await Customer.findByIdAndUpdate(params.id, { ...data, ...stateFromGstin(data.gstin) }, { new: true });
  if (!doc) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  return NextResponse.json({ item: doc });
});

export const DELETE = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  await guard(["admin"]);
  await dbConnect();
  await Customer.findByIdAndDelete(params.id);
  return NextResponse.json({ ok: true });
});
