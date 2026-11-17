/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { deleteDoc, docSchema, updateDoc } from "@/lib/stockDocs";
import { StockDoc, StockItem } from "@/models/Stock";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const okId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

export const GET = (_: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  await guard(); await dbConnect();
  const item = okId(params.id) ? await StockDoc.findById(params.id).lean<any>() : null;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // current balance of each part on the document, shown beside the quantity
  const pns = [...new Set<string>((item.lines ?? []).map((l: any) => l.pn).filter(Boolean))];
  const stock = Object.fromEntries((await StockItem.find({ pn: { $in: pns } }).select("pn balance location").lean<any[]>()).map((i) => [i.pn, { balance: i.balance ?? 0, location: i.location ?? "" }]));
  return NextResponse.json({ item, stock });
});

export const PUT = (req: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  const session = await guard(["admin", "stock"]);
  const d = docSchema.parse(await req.json());
  await dbConnect();
  if (!okId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: await updateDoc(session, params.id, d) });
});

export const DELETE = (_: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  const session = await guard(["admin", "stock"]);
  await dbConnect();
  if (!okId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteDoc(session, params.id);
  return NextResponse.json({ ok: true });
});
