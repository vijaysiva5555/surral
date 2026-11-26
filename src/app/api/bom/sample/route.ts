import { guardAccess, handle } from "@/lib/api";
import { BOM_PAGES } from "@/lib/pageAccess";
import { buildBomSample } from "@/lib/bomSample";

export const dynamic = "force-dynamic";

/** The sample workbook for "Import Excel" on the BOM pages: the layout, example rows and a "How to fill" sheet */
export const GET = () => handle(async () => {
  await guardAccess(BOM_PAGES, "view");
  const buf = await buildBomSample();
  return new Response(buf as unknown as BodyInit, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="BOM-Excel-sample.xlsx"`, "Cache-Control": "no-store",
  } });
});
