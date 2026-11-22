import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { diffChanges } from "@/lib/auditDiff";
import { HsnCode } from "@/models/HsnCode";
import { hsnSchema } from "@/lib/schemas";

export const PUT = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  const s = await guardAccess("hsn"); const d = hsnSchema.parse(await req.json()); await dbConnect();
  const before = await HsnCode.findById(params.id).lean();
  const doc = await HsnCode.findByIdAndUpdate(params.id, d, { new: true });
  if (!doc) return NextResponse.json({ error: "HSN not found" }, { status: 404 });
  await audit(s, "update", "hsn", params.id, `Updated HSN ${d.code}`, diffChanges(before, doc)); return NextResponse.json({ item: doc });
});
export const DELETE = (_: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  const s = await guardAccess("hsn"); await dbConnect();
  const d = await HsnCode.findByIdAndDelete(params.id); if (d) await audit(s, "delete", "hsn", params.id, `Deleted HSN ${d.code}`, diffChanges(d, null, { only: ["description", "gstRate"] }));
  return NextResponse.json({ ok: true });
});
