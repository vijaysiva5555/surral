/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bomSchema } from "@/lib/schemas";
import { bomSummary } from "@/lib/bomCalc";
import { Bom } from "@/models/Bom";
import { parseQuoteCategory } from "@/lib/quoteCategory";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** BOMs hold landed cost and margins, so only admin and sales can see them */
export const GET = (req: NextRequest) => handle(async () => {
  await guard(["admin", "sales"]); await dbConnect();
  const sp = req.nextUrl.searchParams;
  const category = parseQuoteCategory(sp.get("category"));
  const q = sp.get("q")?.trim();
  const base = { category };
  const rows = await Bom.find(q ? { ...base, $or: [{ name: new RegExp(esc(q), "i") }, { "items.description": new RegExp(esc(q), "i") }, { "items.make": new RegExp(esc(q), "i") }] } : base).sort({ updatedAt: -1 }).limit(500).lean<any[]>();
  return NextResponse.json({ items: rows.map((b) => ({ _id: b._id, name: b.name, date: b.date, updatedAt: b.updatedAt, createdByName: b.createdByName, hasImage: !!b.image, summary: bomSummary(b) })) });
});

export const POST = (req: NextRequest) => handle(async () => {
  const s = await guard(["admin", "sales"]);
  const d = bomSchema.parse(await req.json());
  const category = parseQuoteCategory(d.category ?? req.nextUrl.searchParams.get("category"));
  await dbConnect();
  if (await Bom.exists({ category, name: new RegExp(`^${esc(d.name)}$`, "i") })) return NextResponse.json({ error: `A BOM named “${d.name}” already exists in this section.` }, { status: 409 });
  const doc = await Bom.create({ ...d, category, date: new Date(d.date + "T12:00:00Z"), image: d.image || undefined, createdBy: s.user.id, createdByName: s.user.name });
  await audit(s, "create", "bom", String(doc._id), `Created BOM ${d.name} (${d.items.length} items)`);
  return NextResponse.json({ item: doc }, { status: 201 });
});
