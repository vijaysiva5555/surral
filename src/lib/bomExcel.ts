/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from "exceljs";
import { bomSummary, itemLanded, itemTotalLanded, itemTotalList, itemUnitPrice, isBlankItem, rowLetter, type Bom } from "./bomCalc";
import { dmy } from "./format";

const BLUE = "FF00A9E8", GOLD = "FFFFC000";
const thin = { style: "thin" as const, color: { argb: "FF9AA5B1" } }, box = { top: thin, left: thin, bottom: thin, right: thin };
const money = "#,##0.00";

/** One sheet per BOM, laid out like the Excel BOM sheet and with live formulas */
export async function buildBomWorkbook(sheets: { title: string; subtitle?: string; date?: string | Date; bom: Bom }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook(); wb.calcProperties.fullCalcOnLoad = true;
  const used = new Set<string>();
  sheets.forEach((sh, n) => {
    let name = (sh.title || `BOM ${n + 1}`).replace(/[\\/*?:[\]]/g, " ").slice(0, 28).trim() || `BOM ${n + 1}`;
    while (used.has(name)) name = name.slice(0, 25) + ` ${n + 1}`; used.add(name);
    const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    [6, 14, 52, 6, 14, 14, 8, 14, 14, 10, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.getCell("A1").value = `BOM – ${sh.title}`; ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A2").value = [sh.date ? `Date: ${dmy(sh.date as any)}` : "", sh.subtitle].filter(Boolean).join("   ·   "); ws.getCell("A2").font = { color: { argb: "FF555555" } };
    ws.getCell("A3").value = "INTERNAL – not for customers"; ws.getCell("A3").font = { color: { argb: "FFE5381B" }, bold: true, size: 9 };
    ["S.NO", "MAKE", "DESCRIPTION", "QTY", "List Price", "Total List Price", "Dis", "Landed Price", "Total Landed", "Margin", "Unit Price"].forEach((h, i) => {
      const c = ws.getCell(5, i + 1); c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } }; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = box;
    });
    ws.getRow(5).height = 26;
    const items = sh.bom.items.filter((i) => !isBlankItem(i));
    items.forEach((it, k) => {
      const r = 6 + k;
      ws.getCell(`A${r}`).value = rowLetter(k); ws.getCell(`B${r}`).value = it.make; ws.getCell(`C${r}`).value = it.description; ws.getCell(`D${r}`).value = it.qty;
      if (it.listPrice > 0) {
        ws.getCell(`E${r}`).value = it.listPrice;
        ws.getCell(`F${r}`).value = { formula: `E${r}*D${r}`, result: itemTotalList(it) };
        ws.getCell(`G${r}`).value = it.discountPct / 100;
        ws.getCell(`H${r}`).value = { formula: `ROUND(E${r}*(1-G${r}),2)`, result: itemLanded(it) };
      } else ws.getCell(`H${r}`).value = it.landed;            // bought-out item: landed price typed in
      ws.getCell(`I${r}`).value = { formula: `H${r}*D${r}`, result: itemTotalLanded(it) };
      ws.getCell(`J${r}`).value = it.marginPct / 100;
      ws.getCell(`K${r}`).value = { formula: `ROUNDUP(H${r}*(1+J${r}),0)`, result: itemUnitPrice(it) };
      for (let c = 1; c <= 11; c++) { const x = ws.getCell(r, c); x.border = box; x.alignment = { vertical: "middle", wrapText: c === 3, horizontal: c === 1 || c === 4 ? "center" : c >= 5 ? "right" : undefined }; if ([5, 6, 8, 9, 11].includes(c)) x.numFmt = money; if (c === 7 || c === 10) x.numFmt = "0%"; }
    });
    const end = 5 + items.length, s = bomSummary(sh.bom); let r = end + 2;
    const line = (label: string, v: any, fmt = money, strong = false, fill?: string) => {
      ws.mergeCells(`C${r}:E${r}`); const l = ws.getCell(`C${r}`); l.value = label; l.alignment = { horizontal: "right" }; l.font = { bold: true };
      const c = ws.getCell(`F${r}`); c.value = v; c.numFmt = fmt; c.font = { bold: strong || undefined }; c.border = box; if (fill) { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }; }
      r++; return `F${r - 1}`;
    };
    line("Total list price", { formula: `SUM(F6:F${end})`, result: s.list });
    const landed = line("Total landed cost", { formula: `SUM(I6:I${end})`, result: s.landed }, money, true);
    const unit = line("TOTAL UNIT PRICE (price for quotation)", { formula: `SUMPRODUCT(K6:K${end},D6:D${end})`, result: s.price }, money, true, GOLD);
    line("Margin on price", { formula: `(${unit}-${landed})/${unit}`, result: s.marginPct / 100 }, "0.0%");
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
