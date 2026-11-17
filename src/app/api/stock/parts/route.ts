/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { Part } from "@/models/Part";
import { StockItem } from "@/models/Stock";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ?q= — type-ahead for a part number: parts already in the stock ledger first (with their balance), then the Parts master */
export const GET = (req: NextRequest) => handle(async () => {
  await guard(); await dbConnect();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ items: [] });
  const starts = new RegExp("^" + esc(q), "i"), has = new RegExp(esc(q), "i");
  const [stockA, stockB, masterA, masterB] = await Promise.all([
    StockItem.find({ pn: starts }).sort({ pn: 1 }).limit(8).select("pn desc location balance").lean<any[]>(),
    StockItem.find({ $or: [{ pn: has }, { desc: has }] }).sort({ pn: 1 }).limit(8).select("pn desc location balance").lean<any[]>(),
    Part.find({ pn: starts }).sort({ pn: 1 }).limit(12).select("pn desc").lean<any[]>(),
    Part.find({ desc: has }).sort({ pn: 1 }).limit(8).select("pn desc").lean<any[]>(),
  ]);
  const out = new Map<string, any>();
  for (const s of [...stockA, ...stockB]) if (!out.has(s.pn)) out.set(s.pn, { pn: s.pn, desc: s.desc ?? "", location: s.location ?? "", balance: s.balance ?? 0, inLedger: true });
  for (const p of [...masterA, ...masterB]) { const pn = String(p.pn).toUpperCase(); if (!out.has(pn)) out.set(pn, { pn, desc: p.desc ?? "", location: "", balance: null, inLedger: false }); }
  return NextResponse.json({ items: [...out.values()].slice(0, 12) });
});
