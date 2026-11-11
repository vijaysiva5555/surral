/* eslint-disable @typescript-eslint/no-explicit-any */
/* Advanced search: every quoted line (Equipment, Spare and Project) matching the filters, newest first, plus a
   "last price given" summary per part — so a new quotation can reuse the price given to the same customer before.
   Superseded revisions are skipped; internal cost / BOM data is never returned. */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { Quote } from "@/models/Quote";
import { ProjectQuote } from "@/models/ProjectQuote";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PAGE = 25;

export const GET = (req: NextRequest) => handle(async () => {
  await guard();
  await dbConnect();
  const sp = req.nextUrl.searchParams;
  const customerId = sp.get("customerId")?.trim() ?? "";
  const q = sp.get("q")?.trim() ?? "";
  const section = sp.get("section") ?? "";            // "" | equipment | spare | project
  const status = sp.get("status") ?? "";
  const from = sp.get("from") ?? "", to = sp.get("to") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);

  if (customerId && !mongoose.Types.ObjectId.isValid(customerId)) return NextResponse.json({ error: "Invalid customer" }, { status: 400 });

  // ---- filters shared by both collections ----
  const base: any = { status: status ? status : { $ne: "superseded" } };
  if (customerId) base.customerId = new mongoose.Types.ObjectId(customerId);
  if (from || to) {
    base.date = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) base.date.$gte = new Date(`${from}T00:00:00Z`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) base.date.$lte = new Date(`${to}T23:59:59Z`);
  }
  const words = q.split(/\s+/).filter(Boolean).map((w) => new RegExp(esc(w), "i"));
  // every word must appear in the code or the description (so "pump 233776" or "tip green" both work)
  const lineMatch = (code: string, desc: string) => (words.length ? { $and: words.map((re) => ({ $or: [{ [code]: re }, { [desc]: re }] })) } : {});

  const quoteMatch = { ...base, ...(section === "equipment" || section === "spare" ? { category: section } : {}) };
  const quotePipeline: any[] = [
    { $match: quoteMatch },
    { $unwind: "$lines" },
    { $match: lineMatch("lines.code", "lines.description") },
    { $project: {
      _id: 0, quoteId: "$_id", section: { $ifNull: ["$category", "spare"] }, number: 1, revision: 1, date: 1, seq: 1, status: 1,
      customerId: 1, customerName: "$customer.name",
      kind: "$lines.kind", code: { $ifNull: ["$lines.code", ""] }, description: "$lines.description", hsn: "$lines.hsn",
      qty: { $concat: [{ $toString: { $ifNull: ["$lines.qty", 0] } }, " ", { $ifNull: ["$lines.uom", ""] }] },
      basicPrice: { $ifNull: ["$lines.basicPrice", 0] }, discountPct: { $ifNull: ["$lines.discountPct", 0] },
      unitPrice: { $round: [{ $multiply: [{ $ifNull: ["$lines.basicPrice", 0] }, { $subtract: [1, { $divide: [{ $ifNull: ["$lines.discountPct", 0] }, 100] }] }] }, 2] },
      agreement: "$lines.agreement",
    } },
  ];
  const projectPipeline: any[] = [
    { $match: base },
    { $unwind: "$offers" },
    { $unwind: "$offers.items" },
    { $match: lineMatch("offers.items.description", "offers.title") },
    { $project: {
      _id: 0, quoteId: "$_id", section: "project", number: 1, revision: { $literal: 0 }, date: 1, seq: 1, status: 1,
      customerId: 1, customerName: "$customer.name",
      kind: "offer", code: { $literal: "" }, description: "$offers.items.description", offer: "$offers.title", hsn: { $literal: "" },
      qty: { $ifNull: ["$offers.items.qty", ""] },
      basicPrice: { $ifNull: ["$offers.items.unitPrice", 0] }, discountPct: { $literal: 0 }, unitPrice: { $ifNull: ["$offers.items.unitPrice", 0] },
    } },
  ];

  const pipeline: any[] =
    section === "project" ? projectPipeline
      : section === "equipment" || section === "spare" ? quotePipeline
        : [...quotePipeline, { $unionWith: { coll: ProjectQuote.collection.collectionName, pipeline: projectPipeline } }];
  const Source: any = section === "project" ? ProjectQuote : Quote;

  // a part is identified by its code when it has a real one, otherwise by its description
  const partKey = {
    $cond: [
      { $and: [{ $eq: ["$kind", "part"] }, { $ne: ["$code", ""] }] },
      { $toUpper: "$code" },
      { $toLower: { $trim: { input: { $ifNull: ["$description", ""] } } } },
    ],
  };

  const [res] = await Source.aggregate([
    ...pipeline,
    { $sort: { date: -1, seq: -1 } },
    { $facet: {
      rows: [{ $skip: (page - 1) * PAGE }, { $limit: PAGE }],
      total: [{ $count: "n" }],
      summary: [
        { $group: {
          _id: { k: partKey, c: "$customerId" },
          code: { $first: "$code" }, description: { $first: "$description" }, kind: { $first: "$kind" }, customerName: { $first: "$customerName" },
          lastPrice: { $first: "$unitPrice" }, lastBasic: { $first: "$basicPrice" }, lastDiscount: { $first: "$discountPct" }, lastQty: { $first: "$qty" },
          lastDate: { $first: "$date" }, lastQuoteId: { $first: "$quoteId" }, lastNumber: { $first: "$number" }, lastRevision: { $first: "$revision" },
          lastSection: { $first: "$section" }, lastStatus: { $first: "$status" },
          minPrice: { $min: "$unitPrice" }, maxPrice: { $max: "$unitPrice" }, times: { $sum: 1 },
        } },
        { $sort: { lastDate: -1 } },
        { $limit: 30 },
      ],
    } },
  ]).allowDiskUse(true);

  const total = res?.total?.[0]?.n ?? 0;
  return NextResponse.json({
    rows: res?.rows ?? [], total, page, pages: Math.ceil(total / PAGE),
    summary: (res?.summary ?? []).map(({ _id, ...s }: any) => s),
  });
});
