/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { change, diffChanges } from "@/lib/auditDiff";
import { partSchema } from "@/lib/schemas";
import { Part } from "@/models/Part";
import { PartPrice } from "@/models/PartPrice";
import { PriceList } from "@/models/PriceList";
import { PartHsn } from "@/models/PartHsn";
import { savePartPrices } from "@/lib/partAdmin";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ?q=&division=&status=&page=&limit=&listIds=a,b  (omit listIds => all lists) */
export const GET = (req: NextRequest) => handle(async () => {
  await guard();
  await dbConnect();
  const sp = req.nextUrl.searchParams;

  if (sp.get("meta")) {
    const [divisions, statuses] = await Promise.all([Part.distinct("division"), Part.distinct("itemStatus")]);
    return NextResponse.json({ divisions: divisions.filter(Boolean).sort(), statuses: statuses.filter(Boolean).sort() });
  }

  const q = (sp.get("q") ?? "").trim();
  const filter: Record<string, unknown> = {};
  if (q) { const e = esc(q); filter.$or = [{ pn: new RegExp("^" + e.toUpperCase()) }, { pn: new RegExp(e, "i") }, { desc: new RegExp(e, "i") }]; }
  if (sp.get("division")) filter.division = sp.get("division");
  if (sp.get("status")) filter.itemStatus = sp.get("status");
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Number(sp.get("limit")) || 50);

  // the type-ahead (small limit, first page) never shows the total, so it skips the count – on a regex that is the slowest query here
  const picker = limit <= 12 && page === 1;
  const findParts = async () => {
    if (!picker || !q) return Part.find(filter).sort({ pn: 1 }).skip((page - 1) * limit).limit(limit).lean<any[]>();
    // part numbers that START with the text come straight from the index and are listed first; the slower "contains" search only fills the rest of the list
    const { $or: _any, ...rest } = filter; void _any;
    const starts = await Part.find({ ...rest, pn: new RegExp("^" + esc(q.toUpperCase())) }).sort({ pn: 1 }).limit(limit).lean<any[]>();
    if (starts.length >= limit) return starts;
    const more = await Part.find({ ...filter, _id: { $nin: starts.map((p) => p._id) } }).sort({ pn: 1 }).limit(limit - starts.length).lean<any[]>();
    return [...starts, ...more];
  };
  const [total, parts, allLists] = await Promise.all([
    picker ? Promise.resolve(-1) : Part.countDocuments(filter),
    findParts(),
    sp.get("listIds") ? Promise.resolve(null) : PriceList.find().select("_id").lean<any[]>(),
  ]);

  const listIds = allLists ? allLists.map((l) => String(l._id)) : sp.get("listIds")!.split(",");
  const pns = parts.map((p) => p.pn);
  const [prices, hsnRows] = await Promise.all([
    PartPrice.find({ priceListId: { $in: listIds }, pn: { $in: pns } }).lean<any[]>(),
    PartHsn.find({ pn: { $in: pns } }).lean<any[]>(),
  ]);
  const byKey = new Map<string, Record<string, number>>();
  for (const p of prices) {
    const k = `${p.pn}|${p.pga}`;
    (byKey.get(k) ?? byKey.set(k, {}).get(k)!)[String(p.priceListId)] = p.listPrice;
  }

  const hsn = new Map(hsnRows.map((h) => [h.pn, h.hsn] as [string, string]));
  return NextResponse.json({
    total: picker ? parts.length : total, page, pages: picker ? 1 : Math.ceil(total / limit),
    items: parts.map((p) => ({ ...p, hsn: hsn.get(p.pn) ?? "", prices: byKey.get(`${p.pn}|${p.pga}`) ?? {}, costDiscountPct: p.partnerDiscountPct ?? null })),
  });
});

/** Adds a part to the master (admin). Prices and HSN memory are saved with it. */
export const POST = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin"]);
  const { hsn, prices, ...fields } = partSchema.parse(await req.json());
  await dbConnect();
  if (await Part.exists({ pn: fields.pn, pga: fields.pga })) {
    return NextResponse.json({ error: `Part ${fields.pn}${fields.pga ? ` / ${fields.pga}` : ""} already exists.` }, { status: 409 });
  }
  const doc = await Part.create(fields);
  await savePartPrices(fields.pn, fields.pga, prices);
  if (hsn) await PartHsn.updateOne({ pn: fields.pn }, { $set: { hsn } }, { upsert: true });
  await audit(session, "create", "part", String(doc._id), `Added part ${fields.pn}${fields.pga ? ` / ${fields.pga}` : ""}`, [...diffChanges(null, doc, { ignore: ["pn", "pga"] }), ...change("HSN", "", hsn)]);
  return NextResponse.json({ item: doc }, { status: 201 });
});
