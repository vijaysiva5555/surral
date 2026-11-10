/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { quoteInputSchema } from "@/lib/schemas";
import { derive, snapCompany, snapCustomer } from "@/lib/quoteBuild";
import { financialYear } from "@/lib/quoteCalc";
import { nextQuoteSeq } from "@/lib/nextNumber";
import { Quote } from "@/models/Quote";
import { Customer } from "@/models/Customer";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { expireOverdue } from "@/lib/expire";
import { learnHsn } from "@/lib/hsn";
import { learnParts } from "@/lib/learnParts";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handle(async () => {
  await guard();
  await dbConnect();
  await expireOverdue();
  const sp = req.nextUrl.searchParams;
  const filter: any = {};
  const q = sp.get("q")?.trim();
  if (q) { const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); filter.$or = [{ number: re }, { "customer.name": re }, { referredBy: re }]; }
  if (sp.get("status")) filter.status = sp.get("status");
  const customerId = sp.get("customerId")?.trim();
  if (customerId) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) return NextResponse.json({ error: "Invalid customer" }, { status: 400 });
    filter.customerId = customerId;
  }
  const page = Math.max(1, Number(sp.get("page")) || 1), limit = 20;
  const [total, items] = await Promise.all([
    Quote.countDocuments(filter),
    Quote.find(filter).sort({ date: -1, seq: -1, revision: -1 }).skip((page - 1) * limit).limit(limit)
      .select("number revision seq date validUntil status customer.name totals.total referredBy createdBy createdByName").lean(),
  ]);
  return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) });
});

export const POST = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  const input = quoteInputSchema.parse(await req.json());
  await dbConnect();
  const [customer, company, me] = await Promise.all([Customer.findById(input.customerId).lean<any>(), Company.findOne().lean<any>(), User.findById(session.user.id).lean<any>()]);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!company) return NextResponse.json({ error: "Set up the company details first (Company page)." }, { status: 400 });

  const cs = snapCompany(company), cu = snapCustomer(customer, input.contact);
  const d = derive(input, cs, cu);
  const seq = await nextQuoteSeq(company.quoteStartNo ?? 1);
  const fy = financialYear(d.date);
  const doc = await Quote.create({
    ...d, seq, revision: 0, fy, number: `${company.quotePrefix}/${seq}/${fy}`, status: "draft",
    customerId: customer._id, customer: cu, company: cs,
    preparedBy: { name: me?.name ?? session.user.name, phone: me?.phone ?? "" },
    createdBy: session.user.id, createdByName: session.user.name,
  });
  await Promise.all([learnHsn(input.lines), learnParts(input.lines)]);
  await audit(session, "create", "quote", String(doc._id), `Created ${doc.number} for ${cu.name}`);
  return NextResponse.json({ item: doc }, { status: 201 });
});
