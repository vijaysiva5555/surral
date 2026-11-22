/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { diffChanges } from "@/lib/auditDiff";
import { Customer } from "@/models/Customer";
import { Quote } from "@/models/Quote";
import { GST_STATES, stateFromGstin } from "@/lib/india";
import { customerFilter, NO_STATE } from "@/lib/customerFilter";
import { customerSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handle(async () => {
  await guard();
  await dbConnect();
  const sp = req.nextUrl.searchParams;
  const [items, stateRows] = await Promise.all([
    Customer.find(customerFilter(sp.get("q"), sp.get("state"))).sort({ name: 1 }).limit(500).batchSize(500).lean<any[]>(),   // one round trip instead of five
    // every state that has customers (not narrowed by the filters), for the State drop-down
    Customer.aggregate([{ $group: { _id: { $ifNull: ["$stateCode", ""] }, n: { $sum: 1 } } }]),
  ]);
  const states = stateRows
    .map((r) => ({ code: r._id ? String(r._id) : NO_STATE, name: r._id ? GST_STATES[String(r._id)] ?? String(r._id) : "No GST / state", count: r.n as number }))
    .sort((a, b) => (a.code === NO_STATE ? 1 : b.code === NO_STATE ? -1 : a.name.localeCompare(b.name)));
  const ids = items.map((c) => c._id);
  const counts =
    ids.length === 0
      ? []
      : await Quote.aggregate([{ $match: { customerId: { $in: ids } } }, { $group: { _id: "$customerId", n: { $sum: 1 } } }]);
  const byId = new Map(counts.map((x) => [String(x._id), x.n as number]));
  return NextResponse.json({ items: items.map((c) => ({ ...c, quoteCount: byId.get(String(c._id)) ?? 0 })), states });
});

export const POST = (req: NextRequest) => handle(async () => {
  const session = await guardAccess("customers");
  const data = customerSchema.parse(await req.json());
  await dbConnect();
  if (data.gstin) {
    const dup = await Customer.findOne({ gstin: data.gstin }).select("name").lean<{ name: string }>();
    if (dup) return NextResponse.json({ error: `A customer with this GST number already exists: ${dup.name}` }, { status: 409 });
  }
  const doc = await Customer.create({ ...data, ...stateFromGstin(data.gstin) });
  await audit(session, "create", "customer", String(doc._id), `Added customer ${doc.name}`, diffChanges(null, doc, { ignore: ["name", "active"] }));
  return NextResponse.json({ item: doc }, { status: 201 });
});
