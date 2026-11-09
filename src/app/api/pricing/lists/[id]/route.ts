import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { PriceList } from "@/models/PriceList";
import { PartPrice } from "@/models/PartPrice";
import { Quote } from "@/models/Quote";

export const DELETE = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const session = await guard(["admin"]);
  await dbConnect();
  if (await Quote.exists({ priceListId: params.id })) return NextResponse.json({ error: "Quotations already use this price list – it cannot be deleted." }, { status: 409 });
  const pl = await PriceList.findByIdAndDelete(params.id);
  await PartPrice.deleteMany({ priceListId: params.id });
  if (pl) await audit(session, "delete", "priceList", params.id, `Deleted price list ${pl.name}`);
  return NextResponse.json({ ok: true });
});
