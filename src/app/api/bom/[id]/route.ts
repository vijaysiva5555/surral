/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { BOM_PAGES, bomPage } from "@/lib/pageAccess";
import { audit } from "@/lib/audit";
import { diffChanges, snap } from "@/lib/auditDiff";
import { bomSchema } from "@/lib/schemas";
import { Bom } from "@/models/Bom";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const GET = (_: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  await guardAccess(BOM_PAGES, "view"); await dbConnect();
  const b: any = await Bom.findById(params.id).lean();
  if (!b) return NextResponse.json({ error: "BOM not found" }, { status: 404 });
  await guardAccess(bomPage(b.category), "view");
  return NextResponse.json({ item: b });
});

export const PUT = (req: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  const s = await guardAccess(BOM_PAGES);
  const d = bomSchema.parse(await req.json()); await dbConnect();
  const doc: any = await Bom.findById(params.id);
  if (!doc) return NextResponse.json({ error: "BOM not found" }, { status: 404 });
  await guardAccess(bomPage(doc.category));
  if (await Bom.exists({ _id: { $ne: params.id }, category: doc.category, name: new RegExp(`^${esc(d.name)}$`, "i") })) return NextResponse.json({ error: `Another BOM is already named “${d.name}”.` }, { status: 409 });
  const before = snap(doc);
  doc.set({ ...d, date: new Date(d.date + "T12:00:00Z"), image: d.image || undefined });
  await doc.save();
  await audit(s, "update", "bom", params.id, `Saved BOM ${d.name} (${d.items.length} items)`, diffChanges(before, doc));
  return NextResponse.json({ item: doc });
});

export const DELETE = (_: NextRequest, ctx: Ctx) => handle(async () => {
  const params = await ctx.params;
  const s = await guardAccess(BOM_PAGES); await dbConnect();
  const b: any = await Bom.findById(params.id);
  if (b) await guardAccess(bomPage(b.category));
  if (b) { await b.deleteOne(); await audit(s, "delete", "bom", params.id, `Deleted BOM ${b.name}`); }
  return NextResponse.json({ ok: true });   // quotations keep their own copy of the BOM, so they are not affected
});
