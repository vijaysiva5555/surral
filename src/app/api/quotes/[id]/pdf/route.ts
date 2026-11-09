/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { displayNumber } from "@/lib/quoteCalc";
import { renderQuotePdf } from "@/lib/quotePdf";
import { canExportQuote, EXPORT_BLOCKED } from "@/lib/quoteApproval";
import { Quote } from "@/models/Quote";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = (req: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const session = await guard();
  await dbConnect();
  const q: any = await Quote.findById(params.id).lean();
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (!canExportQuote(session, q)) return NextResponse.json({ error: EXPORT_BLOCKED }, { status: 403 });
  const file = `Quotation_${displayNumber(q).replace(/[\\/\s]+/g, "-")}.pdf`;
  const body = await renderQuotePdf(q);
  const inline = req.nextUrl.searchParams.get("inline") ? "inline" : "attachment";
  return new Response(body as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline}; filename="${file}"`, "Cache-Control": "no-store" } });
});
