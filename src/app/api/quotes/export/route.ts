/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { displayNumber } from "@/lib/quoteCalc";
import { expireOverdue } from "@/lib/expire";
import { tableWorkbook, XLSX_TYPE } from "@/lib/xlsxExport";
import { Quote } from "@/models/Quote";
import { quoteStatusLabel } from "@/lib/quoteStatus";

export const dynamic = "force-dynamic";
export const GET = (req: NextRequest) => handle(async () => {
  await guard(); await dbConnect(); await expireOverdue();
  const sp = req.nextUrl.searchParams, filter: any = {};
  const q = sp.get("q")?.trim();
  if (q) { const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); filter.$or = [{ number: re }, { "customer.name": re }, { referredBy: re }]; }
  if (sp.get("status")) filter.status = sp.get("status");
  const customerId = sp.get("customerId")?.trim();
  if (customerId && mongoose.Types.ObjectId.isValid(customerId)) filter.customerId = customerId;
  const rows = await Quote.find(filter).sort({ date: -1, seq: -1, revision: -1 }).limit(20000).lean<any[]>();
  const buf = await tableWorkbook("Quotations", [
    { header: "Quote #", key: "n", width: 26 }, { header: "Date", key: "d", width: 12, fmt: "dd-mmm-yyyy" }, { header: "Valid until", key: "v", width: 12, fmt: "dd-mmm-yyyy" },
    { header: "Customer", key: "c", width: 34 }, { header: "GST no.", key: "g", width: 18 }, { header: "State", key: "st", width: 16 }, { header: "Referred by", key: "r", width: 18 },
    { header: "Status", key: "s", width: 12 }, { header: "Items", key: "i", width: 8 }, { header: "Subtotal", key: "sub", width: 14, fmt: "#,##0.00" },
    { header: "GST", key: "tax", width: 14, fmt: "#,##0.00" }, { header: "Total", key: "t", width: 14, fmt: "#,##0.00" }, { header: "Prepared by", key: "p", width: 18 }, { header: "Created by", key: "cb", width: 18 },
  ], rows.map((x) => ({ n: displayNumber(x), d: x.date, v: x.validUntil, c: x.customer?.name, g: x.customer?.gstin, st: x.customer?.state, r: x.referredBy, s: quoteStatusLabel(x.status), i: x.lines?.length ?? 0,
    sub: x.totals?.subtotal, tax: (x.totals?.cgst ?? 0) + (x.totals?.sgst ?? 0) + (x.totals?.igst ?? 0), t: x.totals?.total, p: x.preparedBy?.name, cb: x.createdByName })));
  return new Response(buf as unknown as BodyInit, { headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="Quotations_${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
});
