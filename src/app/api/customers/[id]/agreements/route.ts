import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { CustomerAgreement } from "@/models/CustomerAgreement";

export const dynamic = "force-dynamic";
const schema = z.object({
  pn: z.string().trim().min(1, "Enter a Graco part number, or * for all parts").transform((s) => s.toUpperCase()),
  discountPct: z.coerce.number().min(0).max(100).nullish(), fixedPrice: z.coerce.number().min(0).nullish(),
  validFrom: z.string().nullish(), validTo: z.string().nullish(), note: z.string().default(""),
}).refine((d) => d.discountPct != null || d.fixedPrice != null, "Enter a discount % or a fixed price");

export const GET = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  await guard(); await dbConnect();
  return NextResponse.json({ items: await CustomerAgreement.find({ customerId: params.id }).sort({ pn: 1 }).lean() });
});
export const POST = (req: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const s = await guard(["admin", "sales"]); const d = schema.parse(await req.json()); await dbConnect();
  if (d.pn !== "*" && d.fixedPrice != null && d.discountPct != null) return NextResponse.json({ error: "Use either a fixed price or a discount %, not both" }, { status: 400 });
  const doc = await CustomerAgreement.create({ customerId: params.id, pn: d.pn, discountPct: d.discountPct ?? undefined, fixedPrice: d.fixedPrice ?? undefined,
    validFrom: d.validFrom ? new Date(d.validFrom + "T00:00:00Z") : undefined, validTo: d.validTo ? new Date(d.validTo + "T23:59:59Z") : undefined, note: d.note, createdByName: s.user.name });
  await audit(s, "create", "agreement", String(doc._id), `Customer price agreement for ${d.pn}`);
  return NextResponse.json({ item: doc }, { status: 201 });
});
