/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { masterDescs } from "@/lib/stock";
import { normPn } from "@/lib/stockCalc";
import { Part } from "@/models/Part";
import { StockItem } from "@/models/Stock";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ?q= — type-ahead for a part number: the part typed in full first, then parts already in the stock ledger (with their
    balance), then the Parts master. A ledger part without a description of its own shows the master's. */
export const GET = (req: NextRequest) => handle(async () => {
  await guard(); await dbConnect();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ items: [] });
  const pn = normPn(q), has = new RegExp(esc(q), "i");
  // part numbers are stored in capitals, so "starts with" is a range the index answers directly
  const starts = { $gte: pn, $lt: pn + String.fromCharCode(0xffff) };
  const [stockA, stockB, masterA, masterB] = await Promise.all([
    StockItem.find({ pn: starts }).sort({ pn: 1 }).limit(8).select("pn desc location balance").lean<any[]>(),
    StockItem.find({ $or: [{ pn: has }, { desc: has }] }).sort({ pn: 1 }).limit(8).select("pn desc location balance").lean<any[]>(),
    Part.find({ pn: starts }).sort({ pn: 1 }).limit(12).select("pn desc").lean<any[]>(),
    Part.find({ desc: has }).sort({ pn: 1 }).limit(8).select("pn desc").lean<any[]>(),
  ]);
  const out = new Map<string, any>();
  for (const s of [...stockA, ...stockB]) if (!out.has(s.pn)) out.set(s.pn, { pn: s.pn, desc: String(s.desc ?? "").trim(), location: s.location ?? "", balance: s.balance ?? 0, inLedger: true });
  for (const p of [...masterA, ...masterB]) { const key = String(p.pn).toUpperCase(); if (!out.has(key)) out.set(key, { pn: key, desc: String(p.desc ?? "").trim(), location: "", balance: null, inLedger: false }); }
  // the part typed in full always leads the list, however many others start with the same characters
  const items = [...out.values()].sort((a, b) => Number(b.pn === pn) - Number(a.pn === pn)).slice(0, 12);
  const blank = items.filter((i) => i.inLedger && !i.desc).map((i) => i.pn);
  if (blank.length) { const master = await masterDescs(blank); for (const i of items) if (!i.desc) i.desc = master.get(i.pn) ?? ""; }
  return NextResponse.json({ items });
});
