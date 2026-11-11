/* eslint-disable @typescript-eslint/no-explicit-any */
/* For the quotation editor: the last price this customer was quoted for each item on the quotation being edited.
   Looks across Equipment and Spare quotations (superseded revisions and the quotation itself are skipped). */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { Quote } from "@/models/Quote";

export const dynamic = "force-dynamic";

const input = z.object({
  customerId: z.string().refine((s) => mongoose.Types.ObjectId.isValid(s), "Invalid customer"),
  keys: z.array(z.string().max(500)).max(300),
  excludeQuoteId: z.string().optional(),
});

export const POST = (req: NextRequest) => handle(async () => {
  await guard();
  const { customerId, keys, excludeQuoteId } = input.parse(await req.json());
  const wanted = [...new Set(keys.filter(Boolean))];
  if (!wanted.length) return NextResponse.json({ matches: {} });
  await dbConnect();

  const match: any = { customerId: new mongoose.Types.ObjectId(customerId), status: { $ne: "superseded" } };
  if (excludeQuoteId && mongoose.Types.ObjectId.isValid(excludeQuoteId)) match._id = { $ne: new mongoose.Types.ObjectId(excludeQuoteId) };

  // same rule as lib/lastPrice.ts lineKey(): "p:<CODE>" for parts with a code, otherwise "d:<description, trimmed, lower case>"
  const key = {
    $cond: [
      { $and: [{ $eq: ["$lines.kind", "part"] }, { $ne: [{ $trim: { input: { $ifNull: ["$lines.code", ""] } } }, ""] }] },
      { $concat: ["p:", { $toUpper: { $trim: { input: "$lines.code" } } }] },
      { $concat: ["d:", { $toLower: { $trim: { input: { $ifNull: ["$lines.description", ""] } } } }] },
    ],
  };
  const unit = { $round: [{ $multiply: [{ $ifNull: ["$lines.basicPrice", 0] }, { $subtract: [1, { $divide: [{ $ifNull: ["$lines.discountPct", 0] }, 100] }] }] }, 2] };

  const rows: any[] = await Quote.aggregate([
    { $match: match },
    { $sort: { date: -1, seq: -1, revision: -1 } },
    { $unwind: "$lines" },
    { $addFields: { k: key, u: unit } },
    { $match: { k: { $in: wanted } } },
    { $group: {
      _id: "$k",
      unitPrice: { $first: "$u" }, basicPrice: { $first: "$lines.basicPrice" }, discountPct: { $first: "$lines.discountPct" },
      qty: { $first: "$lines.qty" }, uom: { $first: "$lines.uom" },
      date: { $first: "$date" }, quoteId: { $first: "$_id" }, number: { $first: "$number" }, revision: { $first: "$revision" },
      category: { $first: { $ifNull: ["$category", "spare"] } }, status: { $first: "$status" },
      times: { $sum: 1 }, minPrice: { $min: "$u" }, maxPrice: { $max: "$u" },
    } },
  ]);
  return NextResponse.json({ matches: Object.fromEntries(rows.map(({ _id, ...r }) => [_id, r])) });
});
