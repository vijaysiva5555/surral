/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { Bom } from "@/models/Bom";

export const POST = (_: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  const s = await guardAccess(["equipmentBom", "spareBom"]); await dbConnect();
  const src: any = await Bom.findById(params.id).lean();
  if (!src) return NextResponse.json({ error: "BOM not found" }, { status: 404 });
  const { _id, createdAt, updatedAt, __v, ...rest } = src;
  let name = `${src.name} (copy)`, n = 2;
  while (await Bom.exists({ category: src.category, name })) name = `${src.name} (copy ${n++})`;
  const doc = await Bom.create({ ...rest, name, date: new Date(), createdBy: s.user.id, createdByName: s.user.name });
  await audit(s, "duplicate", "bom", String(doc._id), `Duplicated BOM ${src.name} → ${name}`);
  return NextResponse.json({ item: { _id: doc._id, name } }, { status: 201 });
});
