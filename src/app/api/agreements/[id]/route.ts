import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { CustomerAgreement } from "@/models/CustomerAgreement";

export const DELETE = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const s = await guard(["admin", "sales"]); await dbConnect();
  const d = await CustomerAgreement.findByIdAndDelete(params.id); if (d) await audit(s, "delete", "agreement", params.id, `Removed customer price agreement for ${d.pn}`);
  return NextResponse.json({ ok: true });
});
