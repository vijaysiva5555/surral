/* eslint-disable @typescript-eslint/no-explicit-any */
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { tableWorkbook, XLSX_TYPE } from "@/lib/xlsxExport";
import { Customer } from "@/models/Customer";

export const dynamic = "force-dynamic";
export const GET = () => handle(async () => {
  await guard(); await dbConnect();
  const rows = await Customer.find().sort({ name: 1 }).lean<any[]>();
  const buf = await tableWorkbook("Customers", [
    { header: "Company", key: "n", width: 36 }, { header: "Address", key: "a", width: 50 }, { header: "Pincode", key: "p", width: 10 }, { header: "GST no.", key: "g", width: 18 },
    { header: "State code", key: "sc", width: 10 }, { header: "State", key: "s", width: 16 }, { header: "Contact", key: "c", width: 22 }, { header: "Mobile", key: "m", width: 14 }, { header: "E-mail", key: "e", width: 26 },
    { header: "Other contacts", key: "o", width: 30 }, { header: "Std discount %", key: "d", width: 12 }, { header: "Active", key: "act", width: 8 },
  ], rows.map((c) => ({ n: c.name, a: (c.addressLines ?? []).join(", "), p: c.pincode, g: c.gstin, sc: c.stateCode, s: c.state, c: c.contacts?.[0]?.name, m: c.contacts?.[0]?.phone, e: c.contacts?.[0]?.email,
    o: (c.contacts ?? []).slice(1).map((x: any) => [x.name, x.phone].filter(Boolean).join(" ")).join("; "), d: c.standardDiscountPct ?? 0, act: c.active === false ? "No" : "Yes" })));
  return new Response(buf as unknown as BodyInit, { headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="Customers_${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
});
