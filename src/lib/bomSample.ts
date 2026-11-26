/* eslint-disable @typescript-eslint/no-explicit-any */
/* The sample Excel for the BOM import: the company's BOM layout with example rows and live formulas, plus an
   instructions sheet. A workbook filled in this way is read by "Import Excel" on any BOM page (see bomImport.ts). */
import ExcelJS from "exceljs";

const BLUE = "FF00A9E8", HEAD = "FFDDEBF7", NOTE = "FFFFF8E1", GREY = "FF6B7280";
const thin = { style: "thin" as const, color: { argb: "FF9AA5B1" } }, box = { top: thin, left: thin, bottom: thin, right: thin };
const money = "#,##0.00";
const HEADERS = ["S.NO", "Part No:", "Description", "Qty", "List Price in INR", "Total Price", "Dis", "Net Price", "Total net price", "Margin 20%", "Unit Price", "Total Price", "Margin 15%", "Unit Price", "Total Price", "Notes"];

type Row = { pn: string; desc: string; qty: number; list?: number; dis?: number; net?: number; margin?: number; margin2?: number; notes?: string };
/** a block with a title row is one section named by the title; a block whose rows start with headings becomes one section per heading */
type Block = { title?: string; rows: (Row | { heading: string })[] };

const BLOCKS: Block[] = [
  // style 1 – a package: title row, header row, items (Graco parts and Surral items together)
  { title: "Promix 1K - 5 Colour, 1 Auto Drop", rows: [
    { pn: "647156", desc: "Husky 1050 AL Pump for Paint", qty: 5, list: 110780, dis: 0.45, margin: 0.2, margin2: 0.15 },
    { pn: "205122", desc: "BPR", qty: 5, list: 49250, dis: 0.45, margin: 0.2, margin2: 0.15 },
    { pn: "214706", desc: "FPR, Spring Operated", qty: 12, list: 47460, dis: 0.45, margin: 0.2, margin2: 0.15, notes: "12 = 10 auto + 2 manual drops" },
    { pn: "Surral", desc: "50 Ltr Tank for Paint", qty: 5, net: 29500, margin: 0.2, margin2: 0.15 },
    { pn: "Surral", desc: "MS Mounting Frame for Pump & Tank", qty: 5, net: 12500, margin: 0.2, margin2: 0.15 },
    { pn: "Surral", desc: "Fittings and Accessories", qty: 2, net: 10000, margin: 0.2, margin2: 0.15, notes: "Includes air line set-up" },
  ] },
  // style 2 – spares grouped under headings (as on a spare quotation): header row, then a heading row before each group
  { rows: [
    { heading: "Consumable Spares" },
    { pn: "24N477", desc: "Air Cap", qty: 1, list: 11660, dis: 0.35, margin: 0.2, margin2: 0.15 },
    { pn: "24N644", desc: "Retaining Ring", qty: 1, list: 2350, dis: 0.35, margin: 0.2, margin2: 0.15 },
    { heading: "Critical Spares" },
    { pn: "125249", desc: "Fx75 O-Ring", qty: 2, list: 1350, dis: 0.35, margin: 0.2, margin2: 0.15, notes: "Keep 2 in stock per gun" },
  ] },
];

export async function buildBomSample(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook(); wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet("BOM", { views: [{ showGridLines: false }] });
  [7, 12, 46, 6, 14, 14, 7, 13, 15, 11, 13, 15, 11, 13, 15, 34].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  let r = 1;
  ws.getCell(`A${r}`).value = "BOM sample – fill in the white cells, keep the header row, then use Import Excel on the BOM page"; ws.getCell(`A${r}`).font = { bold: true, size: 12 };
  r += 2;
  for (const b of BLOCKS) {
    // title row: the block becomes a section of the BOM with this name
    if (b.title) { ws.getCell(`C${r}`).value = b.title; ws.getCell(`C${r}`).font = { bold: true, size: 12, color: { argb: "FF0B2C4D" } }; r++; }
    HEADERS.forEach((h, i) => { const c = ws.getCell(r, i + 1); c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } }; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = box; });
    ws.getRow(r).height = 30; r++;
    const first = r; let n = 0;
    for (const row of b.rows) {
      if ("heading" in row) {   // a heading inside the block starts a new section
        ws.mergeCells(`B${r}:D${r}`); const h = ws.getCell(`B${r}`); h.value = row.heading; h.font = { bold: true }; h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } }; h.border = box;
        r++; continue;
      }
      const set = (col: string, v: any, fmt?: string) => { const c = ws.getCell(`${col}${r}`); c.value = v; if (fmt) c.numFmt = fmt; };
      set("A", ++n); set("B", row.pn); set("C", row.desc); set("D", row.qty);
      if (row.list) {
        set("E", row.list, money); set("F", { formula: `E${r}*D${r}` }, money); set("G", row.dis ?? 0, "0%");
        set("H", { formula: `ROUND(E${r}*(1-G${r}),2)` }, money);
      } else set("H", row.net ?? 0, money);   // a bought-out item: type the net / landed price
      set("I", { formula: `H${r}*D${r}` }, money);
      set("J", row.margin ?? 0.2, "0%"); set("K", { formula: `ROUNDUP(H${r}*(1+J${r}),0)` }, money); set("L", { formula: `K${r}*D${r}` }, money);
      set("M", row.margin2 ?? 0, "0%"); set("N", { formula: `ROUND(K${r}*(1+M${r}),2)` }, money); set("O", { formula: `N${r}*D${r}` }, money);
      if (row.notes) set("P", row.notes);
      for (let c = 1; c <= 16; c++) { const x = ws.getCell(r, c); x.border = box; x.alignment = { vertical: "middle", wrapText: c === 3 || c === 16, horizontal: c === 1 || c === 4 ? "center" : undefined }; if ([6, 9, 11, 12, 14, 15].includes(c)) x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }; }
      r++;
    }
    // summary row (skipped by the import)
    ws.getCell(`H${r}`).value = "Landed"; ws.getCell(`H${r}`).font = { bold: true };
    ws.getCell(`I${r}`).value = { formula: `SUM(I${first}:I${r - 1})` }; ws.getCell(`I${r}`).numFmt = money; ws.getCell(`I${r}`).font = { bold: true };
    ws.getCell(`N${r}`).value = "Total"; ws.getCell(`N${r}`).font = { bold: true };
    ws.getCell(`O${r}`).value = { formula: `SUM(O${first}:O${r - 1})` }; ws.getCell(`O${r}`).numFmt = money; ws.getCell(`O${r}`).font = { bold: true };
    r += 3;
  }

  // ---- instructions ----
  const hw = wb.addWorksheet("How to fill", { views: [{ showGridLines: false }] });
  hw.getColumn(1).width = 4; hw.getColumn(2).width = 26; hw.getColumn(3).width = 90;
  hw.getCell("B2").value = "How to fill the BOM Excel"; hw.getCell("B2").font = { bold: true, size: 14 };
  const rows: [string, string][] = [
    ["Title row", "Type the package name in the Description column (C) above the header row, e.g. \"Promix 1K - 5 Colour\". It becomes the section name."],
    ["Header row", "Keep the header row as it is: S.NO | Part No: | Description | Qty | List Price in INR | … | Notes. The import finds the columns by these names."],
    ["Graco part", "Part No = the Graco part number, List Price and Dis (discount, e.g. 45%). Net Price is worked out from them."],
    ["Bought-out / Surral item", "Part No = Surral (or leave empty), leave List Price empty and type the Net Price (landed cost)."],
    ["Margin / Margin 2", "Margin 20% and Margin 15% per row. Margin 2 is optional – leave it 0 when there is none."],
    ["Headings (spares)", "For spares, put a heading row before each group (e.g. \"Consumable Spares\", \"Critical Spares\") – a row with only that text, no Qty or prices. Each heading becomes its own section, and a spare quotation shows the items under these headings."],
    ["Another package", "Leave a few empty rows, then a new title row and header row – each block becomes its own section (see the two examples on the BOM sheet)."],
    ["Notes", "Anything in the Notes column is kept with the item (internal, not printed on quotations)."],
    ["Grey cells", "Totals and unit prices are calculated. The BOM works them out again on import (unit price = net × (1 + margin), rounded up)."],
    ["Upload", "BOM page → Import Excel → choose this file → tick the blocks → Import into the BOM → check → Save BOM."],
  ];
  rows.forEach(([k, v], i) => {
    const rr = 4 + i;
    hw.getCell(`B${rr}`).value = k; hw.getCell(`B${rr}`).font = { bold: true }; hw.getCell(`B${rr}`).alignment = { vertical: "top" };
    hw.getCell(`C${rr}`).value = v; hw.getCell(`C${rr}`).alignment = { wrapText: true, vertical: "top" };
    hw.getRow(rr).height = v.length > 95 ? 32 : 18;
    if (i % 2) for (const c of ["B", "C"]) hw.getCell(`${c}${rr}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NOTE } };
  });
  hw.getCell(`B${5 + rows.length}`).value = "The example rows on the BOM sheet can be overwritten or deleted."; hw.getCell(`B${5 + rows.length}`).font = { italic: true, color: { argb: GREY } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
