/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertNoNegative, ledgerRows, masterDescs, refreshBalances, stockLocations } from "@/lib/stock";
import { dayLabel, isDay, isQty, ledgerTotals, normPn, qtyText, r2, todayIST } from "@/lib/stockCalc";
import { StockItem, StockMove } from "@/models/Stock";

export const dynamic = "force-dynamic";
const day = z.string().refine(isDay, "Choose a valid date");
const qty = z.number({ invalid_type_error: "Enter a number", required_error: "Enter a number" }).refine(isQty, "Enter a number that is zero or more, with at most two decimals");

/** ?from=&to=&q=&location=&level=low|out|negative|ok&moved=1 — one row per part; a single day (from = to) is the editable day sheet */
export const GET = (req: NextRequest) => handle(async () => {
  await guard(); await dbConnect();
  const sp = req.nextUrl.searchParams, today = todayIST();
  let from = isDay(sp.get("from")) ? sp.get("from")! : today, to = isDay(sp.get("to")) ? sp.get("to")! : from;
  if (to < from) [from, to] = [to, from];
  const [rows, locations, parts] = await Promise.all([
    ledgerRows({ from, to, q: sp.get("q"), location: sp.get("location"), level: sp.get("level"), moved: sp.get("moved") === "1" }),
    stockLocations(), StockItem.estimatedDocumentCount(),
  ]);
  return NextResponse.json({ from, to, today, rows, totals: ledgerTotals(rows), locations, parts });
});

const cell = z.discriminatedUnion("field", [
  z.object({ field: z.literal("inward"), pn: z.string().min(1), date: day, value: qty }),
  z.object({ field: z.literal("outward"), pn: z.string().min(1), date: day, value: qty }),
  z.object({ field: z.literal("opening"), pn: z.string().min(1), date: day.optional(), value: qty }),
  z.object({ field: z.literal("location"), pn: z.string().min(1), date: day.optional(), value: z.string().trim().max(40) }),
  z.object({ field: z.literal("desc"), pn: z.string().min(1), date: day.optional(), value: z.string().trim().max(300) }),
]);

/** Autosave of one ledger cell. Returns the part's row for the day so the sheet can show the recalculated balance. */
export const PATCH = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin", "stock"]);
  const c = cell.parse(await req.json());
  await dbConnect();
  const pn = normPn(c.pn);
  const item = await StockItem.findOne({ pn }).lean<any>();
  if (!item) return NextResponse.json({ error: `Part ${pn} is not in the stock ledger.` }, { status: 404 });
  const date = c.date ?? todayIST();

  if (c.field === "location" || c.field === "desc") {
    if ((item[c.field] ?? "") !== c.value) {
      await StockItem.updateOne({ _id: item._id }, { $set: { [c.field]: c.value } });
      const label = c.field === "location" ? "Location" : "Description";
      await audit(session, "update", "stockItem", String(item._id), `Ledger · ${pn}: ${label} changed`, [{ field: label, from: item[c.field] || "—", to: c.value || "—" }]);
    }
  } else if (c.field === "opening") {
    // a corrected first stock count shifts every later balance by the same amount
    if (r2(item.opening ?? 0) !== r2(c.value)) {
      await assertNoNegative([pn], { opening: { [pn]: c.value } });
      await StockItem.updateOne({ _id: item._id }, { $set: { opening: r2(c.value), openingDate: item.openingDate ?? date } });
      await refreshBalances([pn], "Opening stock corrected");
      await audit(session, "update", "stockItem", String(item._id), `Ledger · ${pn}: opening stock ${qtyText(item.opening ?? 0)} → ${qtyText(c.value)}`, [{ field: "Opening stock", from: qtyText(item.opening ?? 0), to: qtyText(c.value) }]);
    }
  } else {
    const dir = c.field === "inward" ? "in" : "out";
    const moves = await StockMove.find({ pn, date, dir }).select("qty src").lean<any[]>();
    const fromDocs = r2(moves.filter((m) => m.src === "doc").reduce((s, m) => s + m.qty, 0));
    const was = r2(moves.reduce((s, m) => s + m.qty, 0));
    const manual = r2(c.value - fromDocs);
    if (manual < 0) {
      return NextResponse.json({ error: `${qtyText(fromDocs)} of this ${c.field} comes from ${dir === "in" ? "inward entries" : "outward invoices"} dated ${dayLabel(date)}. Change it there – the cell cannot go below ${qtyText(fromDocs)}.` }, { status: 400 });
    }
    if (was !== r2(c.value)) {
      await assertNoNegative([pn], { remove: (m) => m.src === "manual" && m.date === date && m.dir === dir, add: manual > 0 ? [{ pn, date, dir, qty: manual }] : [] });
      if (manual > 0) await StockMove.updateOne({ pn, date, dir, src: "manual" }, { $set: { qty: manual } }, { upsert: true });
      else await StockMove.deleteMany({ pn, date, dir, src: "manual" });
      await refreshBalances([pn], `Ledger entry ${dayLabel(date)}`);
      const label = c.field === "inward" ? "Inward" : "Outward";
      await audit(session, "update", "stockItem", String(item._id), `Ledger ${dayLabel(date)} · ${pn}: ${label} ${qtyText(was)} → ${qtyText(c.value)}`, [{ field: `${label} on ${dayLabel(date)}`, from: qtyText(was), to: qtyText(c.value) }]);
    }
  }
  const [row] = await ledgerRows({ from: date, to: date, pns: [pn] });
  return NextResponse.json({ row });
});

const newItem = z.object({ pn: z.string().trim().min(1, "Enter the part number").max(60), desc: z.string().trim().max(300).default(""), location: z.string().trim().max(40).default(""), opening: qty.default(0), date: day.optional() });

/** Adds a part to the ledger with its first stock count. */
export const POST = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin", "stock"]);
  const d = newItem.parse(await req.json());
  await dbConnect();
  const pn = normPn(d.pn);
  if (await StockItem.exists({ pn })) return NextResponse.json({ error: `Part ${pn} is already in the ledger.` }, { status: 409 });
  const date = d.date ?? todayIST();
  const desc = d.desc || (await masterDescs([pn])).get(pn) || "";   // left empty: the Parts master's description
  const doc = await StockItem.create({ pn, desc, location: d.location, opening: r2(d.opening), openingDate: date, balance: r2(d.opening) });
  await audit(session, "create", "stockItem", String(doc._id), `Added ${pn} to the stock ledger (opening ${qtyText(d.opening)}${d.location ? `, location ${d.location}` : ""})`);
  const [row] = await ledgerRows({ from: date, to: date, pns: [pn] });
  return NextResponse.json({ row }, { status: 201 });
});

/** ?pn= — removes a part that has never moved (a part with movements keeps its history and cannot be removed). */
export const DELETE = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin", "stock"]);
  await dbConnect();
  const pn = normPn(req.nextUrl.searchParams.get("pn"));
  const item = await StockItem.findOne({ pn }).lean<any>();
  if (!item) return NextResponse.json({ error: "Part not found." }, { status: 404 });
  if (await StockMove.exists({ pn })) return NextResponse.json({ error: `${pn} has inward / outward entries, so it cannot be removed from the ledger.` }, { status: 409 });
  await StockItem.deleteOne({ _id: item._id });
  await audit(session, "delete", "stockItem", String(item._id), `Removed ${pn} from the stock ledger (opening ${qtyText(item.opening ?? 0)})`);
  return NextResponse.json({ ok: true });
});
