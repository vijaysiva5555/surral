/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { buildBomWorkbook } from "@/lib/bomExcel";
import { Bom } from "@/models/Bom";

export const dynamic = "force-dynamic";
export const GET = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  await guard(["admin", "sales"]); await dbConnect();
  const b: any = await Bom.findById(params.id).lean();
  if (!b) return NextResponse.json({ error: "BOM not found" }, { status: 404 });
  const buf = await buildBomWorkbook([{ title: b.name, date: b.date, bom: b }]);
  return new Response(buf as unknown as BodyInit, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="BOM_${String(b.name).replace(/[^\w.-]+/g, "_")}.xlsx"`, "Cache-Control": "no-store" } });
});
