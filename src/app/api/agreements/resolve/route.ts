import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { resolveAgreements } from "@/lib/agreements";

export const POST = (req: NextRequest) => handle(async () => {
  await guard();
  const { customerId, pns, date } = z.object({ customerId: z.string().min(1), pns: z.array(z.string()).max(200), date: z.string().optional() }).parse(await req.json());
  await dbConnect();
  return NextResponse.json(await resolveAgreements(customerId, pns, date ? new Date(date + "T12:00:00Z") : new Date()));
});
