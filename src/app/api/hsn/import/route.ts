import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { cellText } from "@/lib/excel";
import { HsnCode } from "@/models/HsnCode";

/** Excel with columns HSN, Description, GST % (header row detected automatically) */
export const POST = (req: NextRequest) => handle(async () => {
  const s = await guard(["admin"]);
  const f = (await req.formData()).get("file");
  if (!(f instanceof File)) return NextResponse.json({ error: "Upload an .xlsx file" }, { status: 400 });
  const wb = new ExcelJS.Workbook(); // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(Buffer.from(await f.arrayBuffer()) as any);
  const ws = wb.worksheets[0]; let hr = 0, cc = 1, cd = 2, cr = 3;
  for (let r = 1; r <= 5 && !hr; r++) ws.getRow(r).eachCell((c, n) => { const t = cellText(c.value); if (/hsn/i.test(t)) { hr = r; cc = n; } });
  if (hr) ws.getRow(hr).eachCell((c, n) => { const t = cellText(c.value); if (/desc/i.test(t)) cd = n; if (/gst|rate|%/i.test(t)) cr = n; });
  await dbConnect(); let added = 0, updated = 0, skipped = 0;
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    const raw = cellText(ws.getRow(r).getCell(cc).value).trim(), code = raw.replace(/\D/g, "");
    if (!/^\d{4,8}$/.test(code)) { if (raw) skipped++; continue; }
    const description = cellText(ws.getRow(r).getCell(cd).value).trim();
    const rate = Number(cellText(ws.getRow(r).getCell(cr).value).replace(/[^\d.]/g, "")) || 18;
    const ex = await HsnCode.findOne({ code });
    if (ex) { ex.set({ description: description || ex.description, gstRate: rate }); await ex.save(); updated++; } else { await HsnCode.create({ code, description, gstRate: rate }); added++; }
  }
  await audit(s, "import", "hsn", "-", `HSN import: ${added} new, ${updated} updated, ${skipped} skipped`);
  return NextResponse.json({ added, updated, skipped });
});
