import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { diffChanges } from "@/lib/auditDiff";
import { HsnCode } from "@/models/HsnCode";
import { hsnSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const GET = (req: NextRequest) => handle(async () => {
  await guard(); await dbConnect();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const filter = q ? { $or: [{ code: new RegExp("^" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }, { description: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] } : {};
  return NextResponse.json({ items: await HsnCode.find(filter).sort({ code: 1 }).limit(Number(req.nextUrl.searchParams.get("limit")) || 300).lean() });
});
export const POST = (req: NextRequest) => handle(async () => {
  const s = await guardAccess("hsn");
  const d = hsnSchema.parse(await req.json()); await dbConnect();
  const doc = await HsnCode.create(d); await audit(s, "create", "hsn", String(doc._id), `Added HSN ${d.code}`, diffChanges(null, doc, { only: ["description", "gstRate"] }));
  return NextResponse.json({ item: doc }, { status: 201 });
});
