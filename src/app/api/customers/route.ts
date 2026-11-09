/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { Customer } from "@/models/Customer";
import { Quote } from "@/models/Quote";
import { stateFromGstin } from "@/lib/india";
import { customerSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handle(async () => {
  await guard();
  await dbConnect();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const filter = q ? { $or: [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { gstin: new RegExp(q, "i") }] } : {};
  const items = await Customer.find(filter).sort({ name: 1 }).limit(500).lean<any[]>();
  const ids = items.map((c) => c._id);
  const counts =
    ids.length === 0
      ? []
      : await Quote.aggregate([{ $match: { customerId: { $in: ids } } }, { $group: { _id: "$customerId", n: { $sum: 1 } } }]);
  const byId = new Map(counts.map((x) => [String(x._id), x.n as number]));
  return NextResponse.json({ items: items.map((c) => ({ ...c, quoteCount: byId.get(String(c._id)) ?? 0 })) });
});

export const POST = (req: NextRequest) => handle(async () => {
  await guard(["admin", "sales"]);
  const data = customerSchema.parse(await req.json());
  await dbConnect();
  if (data.gstin) {
    const dup = await Customer.findOne({ gstin: data.gstin }).select("name").lean<{ name: string }>();
    if (dup) return NextResponse.json({ error: `A customer with this GST number already exists: ${dup.name}` }, { status: 409 });
  }
  const doc = await Customer.create({ ...data, ...stateFromGstin(data.gstin) });
  return NextResponse.json({ item: doc }, { status: 201 });
});
