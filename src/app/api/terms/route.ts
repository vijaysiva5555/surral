/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { termTemplateSchema } from "@/lib/schemas";
import { DEFAULT_TERMS } from "@/lib/quoteCalc";
import { TermTemplate } from "@/models/TermTemplate";

export const dynamic = "force-dynamic";
export const GET = () => handle(async () => {
  await guard(); await dbConnect();
  let items = await TermTemplate.find().sort({ isDefault: -1, name: 1 }).lean();   // one round trip; the default set is created only the first time
  if (!items.length) { await TermTemplate.create({ name: "Standard terms", isDefault: true, terms: DEFAULT_TERMS("{customer}") }); items = await TermTemplate.find().sort({ isDefault: -1, name: 1 }).lean(); }
  return NextResponse.json({ items });
});
export const POST = (req: NextRequest) => handle(async () => {
  const s = await guardAccess("terms"); const d = termTemplateSchema.parse(await req.json()); await dbConnect();
  if (d.isDefault) await TermTemplate.updateMany({}, { isDefault: false });
  const doc = await TermTemplate.create(d); await audit(s, "create", "terms", String(doc._id), `Terms template “${d.name}”`);
  return NextResponse.json({ item: doc }, { status: 201 });
});
