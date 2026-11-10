/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
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

  const [total, parts] = await Promise.all([
    Part.countDocuments(filter),
    Part.find(filter).sort({ pn: 1 }).skip((page - 1) * limit).limit(limit).lean<any[]>(),
  ]);

  const listIds = sp.get("listIds") ? sp.get("listIds")!.split(",") : (await PriceList.find().select("_id").lean<any[]>()).map((l) => String(l._id));
  const prices = await PartPrice.find({ priceListId: { $in: listIds }, pn: { $in: parts.map((p) => p.pn) } }).lean<any[]>();
  const byKey = new Map<string, Record<string, number>>();
  for (const p of prices) {
    const k = `${p.pn}|${p.pga}`;
    (byKey.get(k) ?? byKey.set(k, {}).get(k)!)[String(p.priceListId)] = p.listPrice;
  }

  const hsn = new Map((await PartHsn.find({ pn: { $in: parts.map((p) => p.pn) } }).lean<any[]>()).map((h) => [h.pn, h.hsn] as [string, string]));
  return NextResponse.json({
    total, page, pages: Math.ceil(total / limit),
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
  await audit(session, "create", "part", String(doc._id), `Added part ${fields.pn}${fields.pga ? ` / ${fields.pga}` : ""}`);
  return NextResponse.json({ item: doc }, { status: 201 });
});
