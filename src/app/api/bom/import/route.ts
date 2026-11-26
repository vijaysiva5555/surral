import { NextRequest, NextResponse } from "next/server";
import { guardAccess, handle } from "@/lib/api";
import { BOM_PAGES } from "@/lib/pageAccess";
import { parseBomWorkbook } from "@/lib/bomImport";

export const dynamic = "force-dynamic";
const MAX_MB = 10;

/** Reads an Excel BOM workbook and returns its blocks (title + items) for the BOM sheet to fill in.
    Nothing is saved here – the user checks the sheet and presses Save. */
export const POST = (req: NextRequest) => handle(async () => {
  await guardAccess(BOM_PAGES);
  const f = (await req.formData()).get("file");
  if (!(f instanceof File) || !/\.xlsx$/i.test(f.name)) return NextResponse.json({ error: "Choose an Excel file (.xlsx)." }, { status: 400 });
  if (f.size > MAX_MB * 1024 * 1024) return NextResponse.json({ error: `The file is larger than ${MAX_MB} MB.` }, { status: 400 });
  let sheets;
  try { sheets = await parseBomWorkbook(await f.arrayBuffer()); }
  catch { return NextResponse.json({ error: "The file could not be read as an Excel workbook (.xlsx)." }, { status: 400 }); }
  if (!sheets.length) return NextResponse.json({ error: "No BOM items were found. The sheet needs a header row with S.NO and Description (as in the BOM Excel format), with the items below it. Use Sample Excel on the BOM page to see the format." }, { status: 422 });
  return NextResponse.json({ sheets });
});
