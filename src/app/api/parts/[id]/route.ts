/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { partSchema } from "@/lib/schemas";
import { savePartPrices } from "@/lib/partAdmin";
import { Part } from "@/models/Part";
import { PartPrice } from "@/models/PartPrice";
import { PartHsn } from "@/models/PartHsn";

export const dynamic = "force-dynamic";

/** The part with its HSN memory and every list price, for the admin editor */
export const GET = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  await guard(["admin"]);
  await dbConnect();
  const part: any = await Part.findById(params.id).lean();
  if (!part) return NextResponse.json({ error: "Part not found" }, { status: 404 });
  const [hsn, prices] = await Promise.all([
    PartHsn.findOne({ pn: part.pn }).lean<any>(),
    PartPrice.find({ pn: part.pn, pga: part.pga }).select("priceListId listPrice").lean<any[]>(),
  ]);
  return NextResponse.json({ item: { ...part, hsn: hsn?.hsn ?? "", prices } });
});

/** Edits a part. The part number + PGA make up the key, so they are not changed here. */
export const PUT = (req: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const session = await guard(["admin"]);
  const { hsn, prices, ...fields } = partSchema.parse(await req.json());
  await dbConnect();
  const part: any = await Part.findById(params.id);
  if (!part) return NextResponse.json({ error: "Part not found" }, { status: 404 });
  Object.assign(part, {
    desc: fields.desc, division: fields.division, application: fields.application, discountCode: fields.discountCode,
    sbu: fields.sbu, familyCode: fields.familyCode, itemStatus: fields.itemStatus, recordType: fields.recordType,
    partnerDiscountPct: fields.partnerDiscountPct ?? undefined,
  });
  await part.save();
  await savePartPrices(part.pn, part.pga, prices);
  if (hsn) await PartHsn.updateOne({ pn: part.pn }, { $set: { hsn } }, { upsert: true });
  else await PartHsn.deleteOne({ pn: part.pn });
  await audit(session, "update", "part", params.id, `Edited part ${part.pn}${part.pga ? ` / ${part.pga}` : ""}`);
  return NextResponse.json({ item: part });
});

/** Removes a part with its list prices; issued quotations keep the lines they already saved. */
export const DELETE = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const session = await guard(["admin"]);
  await dbConnect();
  const part: any = await Part.findByIdAndDelete(params.id);
  if (!part) return NextResponse.json({ error: "Part not found" }, { status: 404 });
  await PartPrice.deleteMany({ pn: part.pn, pga: part.pga });
  // the same part number can exist under another PGA – only forget its HSN when no variant is left
  if (!(await Part.exists({ pn: part.pn }))) await PartHsn.deleteMany({ pn: part.pn });
  await audit(session, "delete", "part", params.id, `Deleted part ${part.pn}${part.pga ? ` / ${part.pga}` : ""}`);
  return NextResponse.json({ ok: true });
});
