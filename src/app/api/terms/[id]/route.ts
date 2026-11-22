import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { diffChanges } from "@/lib/auditDiff";
import { termTemplateSchema } from "@/lib/schemas";
import { TermTemplate } from "@/models/TermTemplate";

export const PUT = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  const s = await guardAccess("terms"); const d = termTemplateSchema.parse(await req.json()); await dbConnect();
  if (d.isDefault) await TermTemplate.updateMany({ _id: { $ne: params.id } }, { isDefault: false });
  const before = await TermTemplate.findById(params.id).lean();
  const doc = await TermTemplate.findByIdAndUpdate(params.id, d, { new: true });
  if (!doc) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  await audit(s, "update", "terms", params.id, `Terms template “${d.name}”`, diffChanges(before, doc)); return NextResponse.json({ item: doc });
});
export const DELETE = (_: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  const s = await guardAccess("terms"); await dbConnect();
  const t = await TermTemplate.findById(params.id);
  if (t?.isDefault && (await TermTemplate.countDocuments()) > 1) return NextResponse.json({ error: "Make another template the default before deleting this one." }, { status: 400 });
  if (t) { await t.deleteOne(); await audit(s, "delete", "terms", params.id, `Deleted terms template “${t.name}”`); }
  return NextResponse.json({ ok: true });
});
