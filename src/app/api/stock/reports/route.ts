/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { ledgerRows } from "@/lib/stock";
import { dayLabel, isDay, ledgerTotals, periodRange, r2, todayIST, type Period } from "@/lib/stockCalc";
import { tableWorkbook, XLSX_TYPE } from "@/lib/xlsxExport";
import { StockDoc } from "@/models/Stock";

export const dynamic = "force-dynamic";
const KINDS = ["stock", "outward", "inward", "low"] as const;
type Kind = (typeof KINDS)[number];
const PERIODS: Period[] = ["day", "week", "month", "year", "range"];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ?kind=stock|outward|inward|low &period=day|week|month|year|range &date= &to= &q= &moved=1 &format=xlsx
    stock   – per part: opening at the start of the period, inward, outward, closing at its end
    outward / inward – every invoice line in the period
    low     – parts at or below the low-stock level at the end of the period */
export const GET = (req: NextRequest) => handle(async () => {
  await guard(); await dbConnect();
  const sp = req.nextUrl.searchParams;
  const kind: Kind = KINDS.includes(sp.get("kind") as Kind) ? (sp.get("kind") as Kind) : "stock";
  const period: Period = PERIODS.includes(sp.get("period") as Period) ? (sp.get("period") as Period) : "day";
  const date = isDay(sp.get("date")) ? sp.get("date")! : todayIST();
  const { from, to } = periodRange(period, date, isDay(sp.get("to")) ? sp.get("to")! : undefined);
  const q = sp.get("q")?.trim() ?? "";
  const xlsx = sp.get("format") === "xlsx";
  const span = from === to ? dayLabel(from) : `${dayLabel(from)} to ${dayLabel(to)}`;
  const file = (name: string, buf: Buffer) => new Response(buf as unknown as BodyInit, { headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="${name}_${from}${from === to ? "" : `_to_${to}`}.xlsx"`, "Cache-Control": "no-store" } });

  if (kind === "stock" || kind === "low") {
    const rows = await ledgerRows(kind === "low" ? { from: to, to, q, level: "low" } : { from, to, q, moved: sp.get("moved") === "1" });
    if (kind === "low") rows.sort((a, b) => a.closing - b.closing || a.pn.localeCompare(b.pn));
    const totals = ledgerTotals(rows);
    if (!xlsx) return NextResponse.json({ kind, period, from, to, span, rows, totals });
    const buf = await tableWorkbook(kind === "low" ? "Low stock" : "Stock ledger", [
      { header: "Location", key: "l", width: 12 }, { header: "Part no.", key: "p", width: 16 }, { header: "Item Description", key: "d", width: 48 },
      ...(kind === "low" ? [{ header: `Balance on ${dayLabel(to)}`, key: "c", width: 18 }] : [{ header: "Op. Balance", key: "o", width: 13 }, { header: "Inward", key: "i", width: 11 }, { header: "Outward", key: "u", width: 11 }, { header: "Current Balance", key: "c", width: 16 }]),
    ], [...rows.map((r) => ({ l: r.location, p: r.pn, d: r.desc, o: r.opening, i: r.inward, u: r.outward, c: r.closing })),
      ...(kind === "stock" ? [{}, { d: `Total · ${span} · ${rows.length} parts`, o: totals.opening, i: totals.inward, u: totals.outward, c: totals.closing }] : [])]);
    return file(kind === "low" ? "Low_stock" : "Stock_ledger", buf);
  }

  const type = kind === "inward" ? "in" : "out";
  const filter: Record<string, any> = { type, date: { $gte: from, $lte: to } };
  if (q) { const re = new RegExp(esc(q), "i"); filter.$or = [{ no: re }, { party: re }, { "lines.pn": re }, { "lines.desc": re }]; }
  const docs = await StockDoc.find(filter).sort({ date: 1, createdAt: 1 }).limit(5000).batchSize(5000).lean<any[]>();
  const re = q ? new RegExp(esc(q), "i") : null;
  const lines = docs.flatMap((d) => {
    const whole = !re || re.test(d.no ?? "") || re.test(d.party ?? "");   // a match on the invoice shows all its lines, a match on a part only that line
    return (d.lines ?? []).filter((l: any) => whole || re!.test(l.pn ?? "") || re!.test(l.desc ?? "")).map((l: any) => ({ id: String(d._id), date: d.date, no: d.no, party: d.party, pn: l.pn, desc: l.desc, qty: l.qty, remarks: l.remarks || d.remarks || "" }));
  });
  const qty = r2(lines.reduce((s, l) => s + l.qty, 0));
  if (!xlsx) return NextResponse.json({ kind, period, from, to, span, lines, totals: { qty, invoices: new Set(lines.map((l) => l.id)).size } });
  const buf = await tableWorkbook(kind === "inward" ? "Inward" : "Outward", kind === "inward"
    ? [{ header: "Date", key: "dt", width: 12 }, { header: "Supplier", key: "pa", width: 28 }, { header: "Invoice no.", key: "no", width: 20 }, { header: "Part no.", key: "p", width: 16 }, { header: "Item Description", key: "d", width: 48 }, { header: "Qty", key: "q", width: 10 }, { header: "Remarks", key: "r", width: 24 }]
    : [{ header: "Invoice no.", key: "no", width: 14 }, { header: "Invoice date", key: "dt", width: 13 }, { header: "Customer Name", key: "pa", width: 40 }, { header: "Part no.", key: "p", width: 16 }, { header: "Item Description", key: "d", width: 48 }, { header: "Qty", key: "q", width: 10 }, { header: "Remarks", key: "r", width: 24 }],
    [...lines.map((l) => ({ dt: dayLabel(l.date), no: l.no, pa: l.party, p: l.pn, d: l.desc, q: l.qty, r: l.remarks })), {}, { d: `Total · ${span} · ${lines.length} lines`, q: qty }]);
  return file(kind === "inward" ? "Inward" : "Outward", buf);
});
