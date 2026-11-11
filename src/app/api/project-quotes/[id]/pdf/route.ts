/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { renderProjectQuotePdf } from "@/lib/projectPdf";
import { ProjectQuote } from "@/models/ProjectQuote";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = (req: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  await guard();
  await dbConnect();
  const q: any = await ProjectQuote.findById(params.id).lean();
  if (!q) return NextResponse.json({ error: "Project offer not found" }, { status: 404 });
  const body = await renderProjectQuotePdf(q);
  const inline = req.nextUrl.searchParams.get("inline") ? "inline" : "attachment";
  const file = `${String(q.number).replace(/[\\/\s]+/g, "-")}.pdf`;
  return new Response(body as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline}; filename="${file}"`, "Cache-Control": "no-store" },
  });
});
