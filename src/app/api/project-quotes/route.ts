/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { financialYear } from "@/lib/quoteCalc";
import { nextProjectSeq } from "@/lib/nextNumber";
import {
  projectQuoteInputSchema, projectTotals, snapProjectCompany, snapProjectCustomer, projectNumberPrefix,
} from "@/lib/projectQuote";
import { ProjectQuote } from "@/models/ProjectQuote";
import { Customer } from "@/models/Customer";
import { Company } from "@/models/Company";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handle(async () => {
  await guard();
  await dbConnect();
  const sp = req.nextUrl.searchParams;
  const filter: any = {};
  const q = sp.get("q")?.trim();
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ number: re }, { "customer.name": re }, { subject: re }];
  }
  if (sp.get("status")) filter.status = sp.get("status");
  const page = Math.max(1, Number(sp.get("page")) || 1), limit = 20;
  const [total, items] = await Promise.all([
    ProjectQuote.countDocuments(filter),
    ProjectQuote.find(filter).sort({ date: -1, seq: -1 }).skip((page - 1) * limit).limit(limit)
      .select("number seq date status customer.name subject totals.total createdBy createdByName").lean(),
  ]);
  return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) });
});

export const POST = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  const input = projectQuoteInputSchema.parse(await req.json());
  await dbConnect();
  const [customer, company, me] = await Promise.all([
    Customer.findById(input.customerId).lean<any>(),
    Company.findOne().lean<any>(),
    User.findById(session.user.id).lean<any>(),
  ]);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!company) return NextResponse.json({ error: "Set up the company details first (Company page)." }, { status: 400 });

  const date = new Date(input.date + "T12:00:00Z");
  const seq = await nextProjectSeq(company.projectStartNo ?? 1);
  const prefix = company.projectPrefix || projectNumberPrefix(company);
  const doc = await ProjectQuote.create({
    ...input,
    date, seq, fy: financialYear(date), number: `${prefix}/${seq}/${financialYear(date)}`, status: "draft",
    customerId: customer._id,
    customer: snapProjectCustomer(customer, input.contact),
    company: snapProjectCompany(company),
    preparedBy: input.preparedBy || me?.name || session.user.name,
    signerName: input.signerName || me?.name || session.user.name,
    signerPhone: input.signerPhone || me?.phone || "",
    signerEmail: input.signerEmail || company.email || "",
    totals: projectTotals(input.offers, input.terms.find((t) => /tax/i.test(t.label))?.value || "GST 18% Extra"),
    createdBy: session.user.id, createdByName: session.user.name,
  });
  await audit(session, "create", "projectQuote", String(doc._id), `Created project offer ${doc.number} for ${customer.name}`);
  return NextResponse.json({ item: doc }, { status: 201 });
});
