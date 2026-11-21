/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { renderProjectQuoteDocx } from "@/lib/projectDocx";
import { ProjectQuote } from "@/models/ProjectQuote";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** the project quotation as an editable Word document */
export const GET = (_req: Request, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  await guard();
  await dbConnect();
  const q: any = await ProjectQuote.findById(params.id).lean();
  if (!q) return NextResponse.json({ error: "Project offer not found" }, { status: 404 });
  const body = await renderProjectQuoteDocx(q);
  const file = `${String(q.number).replace(/[\/\s]+/g, "-")}.docx`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
});
