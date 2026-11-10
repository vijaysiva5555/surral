import { NextRequest, NextResponse } from "next/server";
import { displayNumber } from "@/lib/quoteCalc";
import { findShared } from "@/lib/publicQuote";
import { renderQuotePdf } from "@/lib/quotePdf";
import { tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  if (tooMany(`pub:${req.headers.get("x-forwarded-for") ?? "local"}`, 60, 10 * 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const q = await findShared(params.token);
  if (!q) return NextResponse.json({ error: "This link is no longer valid." }, { status: 404 });
  const buf = await renderQuotePdf(q.toObject());
  return new Response(buf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Quotation_${displayNumber(q).replace(/[\\/\s]+/g, "-")}.pdf"`, "Cache-Control": "no-store" } });
}
