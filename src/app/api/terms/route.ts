/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { termTemplateSchema } from "@/lib/schemas";
import { DEFAULT_TERMS } from "@/lib/quoteCalc";
import { TermTemplate } from "@/models/TermTemplate";

export const dynamic = "force-dynamic";
export const GET = () => handle(async () => {
  await guard(); await dbConnect();
  if (!(await TermTemplate.countDocuments())) await TermTemplate.create({ name: "Standard terms", isDefault: true, terms: DEFAULT_TERMS("{customer}") });
  return NextResponse.json({ items: await TermTemplate.find().sort({ isDefault: -1, name: 1 }).lean() });
});
export const POST = (req: NextRequest) => handle(async () => {
  const s = await guard(["admin"]); const d = termTemplateSchema.parse(await req.json()); await dbConnect();
  if (d.isDefault) await TermTemplate.updateMany({}, { isDefault: false });
  const doc = await TermTemplate.create(d); await audit(s, "create", "terms", String(doc._id), `Terms template “${d.name}”`);
  return NextResponse.json({ item: doc }, { status: 201 });
});
