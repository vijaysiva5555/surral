/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { findSharedProject } from "@/lib/publicProjectQuote";
import { renderProjectQuotePdf } from "@/lib/projectPdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = (req: NextRequest, { params }: { params: { token: string } }) => {
  return findSharedProject(params.token, true)
    .then(async (q) => {
      if (!q) return NextResponse.json({ error: "Link not available" }, { status: 404 });
      const body = await renderProjectQuotePdf(q);
      const inline = req.nextUrl.searchParams.get("inline") ? "inline" : "attachment";
      const file = `${String(q.number).replace(/[\\/\s]+/g, "-")}.pdf`;
      return new Response(body as BodyInit, {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline}; filename="${file}"`, "Cache-Control": "no-store" },
      });
    })
    .catch((e) => {
      console.error(e);
      return NextResponse.json({ error: "Could not build the PDF" }, { status: 500 });
    });
};
