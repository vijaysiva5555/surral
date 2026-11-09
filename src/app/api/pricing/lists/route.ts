import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { PriceList } from "@/models/PriceList";

export const dynamic = "force-dynamic";
export const GET = () => handle(async () => {
  await guard();
  await dbConnect();
  return NextResponse.json({ items: await PriceList.find().sort({ effectiveFrom: -1 }).lean() });
});
