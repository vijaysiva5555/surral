/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bomSchema } from "@/lib/schemas";
import { Bom } from "@/models/Bom";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const GET = (_: NextRequest, { params }: Ctx) => handle(async () => {
  await guard(["admin", "sales"]); await dbConnect();
  const b = await Bom.findById(params.id).lean();
  return b ? NextResponse.json({ item: b }) : NextResponse.json({ error: "BOM not found" }, { status: 404 });
});

export const PUT = (req: NextRequest, { params }: Ctx) => handle(async () => {
  const s = await guard(["admin", "sales"]);
  const d = bomSchema.parse(await req.json()); await dbConnect();
  const doc: any = await Bom.findById(params.id);
  if (!doc) return NextResponse.json({ error: "BOM not found" }, { status: 404 });
  if (await Bom.exists({ _id: { $ne: params.id }, name: new RegExp(`^${esc(d.name)}$`, "i") })) return NextResponse.json({ error: `Another BOM is already named “${d.name}”.` }, { status: 409 });
  doc.set({ ...d, date: new Date(d.date + "T12:00:00Z"), image: d.image || undefined });
  await doc.save();
  await audit(s, "update", "bom", params.id, `Saved BOM ${d.name} (${d.items.length} items)`);
  return NextResponse.json({ item: doc });
});

export const DELETE = (_: NextRequest, { params }: Ctx) => handle(async () => {
  const s = await guard(["admin", "sales"]); await dbConnect();
  const b: any = await Bom.findById(params.id);
  if (b) { await b.deleteOne(); await audit(s, "delete", "bom", params.id, `Deleted BOM ${b.name}`); }
  return NextResponse.json({ ok: true });   // quotations keep their own copy of the BOM, so they are not affected
});
