/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { createDoc, docSchema, parseDocType } from "@/lib/stockDocs";
import { isDay } from "@/lib/stockCalc";
import { StockDoc } from "@/models/Stock";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ?type=in|out&q=&from=&to=&page=&limit= — inward entries or outward invoices, newest first */
export const GET = (req: NextRequest) => handle(async () => {
  await guard(); await dbConnect();
  const sp = req.nextUrl.searchParams;
  const type = parseDocType(sp.get("type"));
  if (!type) return NextResponse.json({ error: "type must be in or out" }, { status: 400 });
  const filter: Record<string, any> = { type };
  const q = sp.get("q")?.trim();
  if (q) { const re = new RegExp(esc(q), "i"); filter.$or = [{ no: re }, { party: re }, { "lines.pn": re }, { "lines.desc": re }]; }
  const from = sp.get("from"), to = sp.get("to");
  if (isDay(from) || isDay(to)) filter.date = { ...(isDay(from) ? { $gte: from } : {}), ...(isDay(to) ? { $lte: to } : {}) };
  const page = Math.max(1, Number(sp.get("page")) || 1), limit = Math.min(200, Number(sp.get("limit")) || 50);
  const [total, items] = await Promise.all([
    StockDoc.countDocuments(filter),
    StockDoc.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean<any[]>(),
  ]);
  return NextResponse.json({ total, page, pages: Math.ceil(total / limit), items });
});

export const POST = (req: NextRequest) => handle(async () => {
  await guardAccess(["stockInward", "stockOutward"]);
  const d = docSchema.parse(await req.json());
  const session = await guardAccess(d.type === "in" ? "stockInward" : "stockOutward");
  await dbConnect();
  const doc = await createDoc(session, d);
  return NextResponse.json({ item: doc }, { status: 201 });
});
