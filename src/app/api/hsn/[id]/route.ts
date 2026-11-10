import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { HsnCode } from "@/models/HsnCode";
import { hsnSchema } from "@/lib/schemas";

export const PUT = (req: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const s = await guard(["admin", "sales"]); const d = hsnSchema.parse(await req.json()); await dbConnect();
  const doc = await HsnCode.findByIdAndUpdate(params.id, d, { new: true });
  if (!doc) return NextResponse.json({ error: "HSN not found" }, { status: 404 });
  await audit(s, "update", "hsn", params.id, `Updated HSN ${d.code}`); return NextResponse.json({ item: doc });
});
export const DELETE = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const s = await guard(["admin", "sales"]); await dbConnect();
  const d = await HsnCode.findByIdAndDelete(params.id); if (d) await audit(s, "delete", "hsn", params.id, `Deleted HSN ${d.code}`);
  return NextResponse.json({ ok: true });
});
