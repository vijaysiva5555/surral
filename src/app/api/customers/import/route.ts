import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { Customer } from "@/models/Customer";
import { parseCustomerWorkbook } from "@/lib/customerImport";

export const POST = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Upload an .xlsx file" }, { status: 400 });
  const parsed = await parseCustomerWorkbook(Buffer.from(await file.arrayBuffer()));
  await dbConnect();
  let created = 0, updated = 0;
  
  for (const c of parsed) {
    // match on GSTIN when present, else on exact name
    const existing = await Customer.findOne(c.gstin ? { gstin: c.gstin } : { name: c.name });
    if (existing) { await existing.set(c).save(); updated++; } else { await Customer.create(c); created++; }
  }
  await audit(session, "import", "customer", "-", `Excel import: ${created} new, ${updated} updated`);
  return NextResponse.json({ total: parsed.length, created, updated });
});
