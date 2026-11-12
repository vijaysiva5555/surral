/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from "exceljs";
import { displayNumber, lineTotal } from "./quoteCalc";
import { buildBomWorkbook } from "./bomExcel";
import { dmy } from "./format";
import { loadBranding, loadImage, type Img } from "./branding";
import { fit } from "./imageSize";

const BLUE = "FF00A9E8", GOLD = "FFFFC000", YELLOW = "FFFFEB3B", GREY = "FFF2F4F7", INK = "FF111111";
const thin = { style: "thin" as const, color: { argb: "FF9AA5B1" } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const money = '#,##0.00';

/** Customer-facing quotation workbook – same layout as the PDF, with live formulas */
export async function buildQuoteWorkbook(q: any): Promise<Buffer> {
  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const wb = new ExcelJS.Workbook(); wb.creator = co.name; wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet("Quotation", { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.2 } } });
  [6, 12, 43, 11, 7, 14, 8, 14, 15].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const font = (o: any = {}) => ({ name: "Arial", size: 9, color: { argb: INK }, ...o });
  const put = (addr: string, v: any, o: any = {}) => { const c = ws.getCell(addr); c.value = v; c.font = font(o.font); if (o.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } }; c.alignment = { vertical: "middle", wrapText: true, ...(o.align ? { horizontal: o.align } : {}) }; if (o.border) c.border = box; if (o.fmt) c.numFmt = o.fmt; return c; };
  const merge = (r: string) => ws.mergeCells(r);

  // letterhead
  const { logo, partner: graco } = await loadBranding();
  if (logo) ws.addImage(wb.addImage({ buffer: logo.data as any, extension: logo.format === "jpg" ? "jpeg" : "png" }), { tl: { col: 0.1, row: 0.2 }, ext: fit(logo, 62, 84) });
  if (graco) ws.addImage(wb.addImage({ buffer: graco.data as any, extension: graco.format === "jpg" ? "jpeg" : "png" }), { tl: { col: 8.9, row: 0.3 }, ext: fit(graco, 66, 72) });
  merge("C1:H2"); put("C1", co.name, { font: { size: 15, bold: true, italic: true }, align: "center" });
  merge("C3:H3"); put("C3", co.tagline, { font: { size: 8, bold: true, italic: true }, align: "center" });
  ws.getRow(1).height = 22; ws.getRow(2).height = 22; ws.getRow(3).height = 16; ws.getRow(4).height = 22;

  const left = [...(co.addressLines ?? []), co.state && `State:${co.state}`, co.stateCode && `State Code:${co.stateCode}`, co.gstin && `GST No:${co.gstin}`, co.website && `Website:  ${co.website}`, co.phone && `Phone:${co.phone}`, co.mobile && `Mobile:${co.mobile}`, q.preparedBy?.name && `Prepared by:${q.preparedBy.name}${q.preparedBy.phone ? " - " + q.preparedBy.phone : ""}`].filter(Boolean);
  let r = 5;
  left.forEach((l, i) => { merge(`A${r + i}:E${r + i}`); put(`A${r + i}`, l, { font: { size: 8.5 } }); });
  merge(`F${r}:J${r}`); put(`F${r}`, "Sales Quotation", { font: { size: 13, bold: true, color: { argb: "FFE5381B" } }, align: "right" });
  [["DATE", dmy(q.date)], ["QUOTE #", displayNumber(q)], ["Referred By", q.referredBy], ["VALID UNTIL", `${q.validityDays} Days from the date of Quotation`]].forEach(([k, v], i) => {
    const rr = r + 1 + i; merge(`F${rr}:G${rr}`); put(`F${rr}`, k, { align: "right" }); merge(`H${rr}:J${rr}`); const c = put(`H${rr}`, v, {}); c.border = { bottom: thin };
  });
  r += Math.max(left.length, 5) + 1;

  // customer
  merge(`A${r}:J${r}`); put(`A${r}`, "Customer details:", { font: { bold: true, color: { argb: "FFFFFFFF" } }, fill: BLUE, align: "center" }); r++;
  const custL = [`M/s.${cu.name}`, ...(cu.addressLines ?? []).map((l: string, i: number, a: string[]) => (i === a.length - 1 && cu.pincode && !l.includes(cu.pincode) ? `${l} - ${cu.pincode}` : l)), "", `GST: ${cu.gstin ?? ""}`];
  custL.forEach((l, i) => { merge(`A${r + i}:E${r + i}`); put(`A${r + i}`, l, { font: { bold: i === 0 } }); });
  if (cu.contact?.name) { merge(`F${r}:J${r}`); put(`F${r}`, cu.contact.name, { font: { bold: true } }); }
  if (cu.contact?.phone) { merge(`F${r + 1}:J${r + 1}`); put(`F${r + 1}`, `Mobile: ${cu.contact.phone}`); }
  r += custL.length + 1;

  // items
  ["S.No", "Code No", "Description of Goods", "HSN Code", "Qty", "Basic Price in Rs.", "Disc.", "Unit Price in Rs.", "Total Price in Rs."].forEach((h, i) =>
    put(`${"ABCDEFGHI"[i]}${r}`, h, { font: { bold: true, color: { argb: "FFFFFFFF" }, size: 8 }, fill: BLUE, align: "center", border: true }));
  ws.getRow(r).height = 30; r++;
  const first = r; let imageDone = false;
  (q.lines ?? []).forEach((l: any, i: number) => {
    put(`A${r}`, i + 1, { align: "center", border: true }); put(`B${r}`, l.code, { align: "center", border: true }); put(`C${r}`, l.description, { border: true });
    put(`D${r}`, l.hsn, { align: "center", border: true }); put(`E${r}`, l.qty, { align: "center", border: true });
    put(`F${r}`, l.basicPrice, { align: "right", border: true, fmt: money }); put(`G${r}`, (l.discountPct ?? 0) / 100, { align: "center", border: true, fmt: "0.##%;;\"-\"" });
    ws.getCell(`H${r}`).value = { formula: `ROUND(F${r}*(1-G${r}),2)`, result: Math.round(l.basicPrice * (1 - (l.discountPct ?? 0) / 100) * 100) / 100 }; put(`H${r}`, ws.getCell(`H${r}`).value, { align: "right", border: true, fmt: money });
    ws.getCell(`I${r}`).value = { formula: `ROUND(H${r}*E${r},2)`, result: lineTotal(l) }; put(`I${r}`, ws.getCell(`I${r}`).value, { align: "right", border: true, fmt: money, font: { bold: true } });
    ws.getRow(r).height = Math.max(18, Math.ceil(String(l.description).length / 38) * 13); r++;
    if (l.subItems?.length) {
      const top = r; merge(`B${r}:D${r}`); put(`B${r}`, "Consists Of:", { font: { bold: true }, fill: YELLOW, align: "center", border: true }); r++;
      l.subItems.forEach((x: string) => { merge(`B${r}:D${r}`); put(`B${r}`, x, { fill: GREY, border: true, font: { size: 8.5 } }); r++; });
      if (q.image && !imageDone) {
        imageDone = true; const m = String(q.image).match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/);
        if (m) { ws.addImage(wb.addImage({ base64: m[2], extension: (m[1] === "jpg" ? "jpeg" : m[1]) as any }), { tl: { col: 4.15, row: top + 0.1 }, ext: { width: 270, height: Math.min(210, (r - top) * 17.5) } }); }
        if (r - top < 11) r = top + 11;   // leave room for the photo
        merge(`E${r}:I${r}`); put(`E${r}`, q.imageCaption || "Image is for illustrative purpose only", { font: { size: 7, bold: true }, align: "center" }); r++;
      }
    }
  });
  const last = r - 1;
  r += 1;

  // uploaded photos (S3) – three per row below the items, like the PDF
  const photos = (await Promise.all((q.images ?? []).map(loadImage))).filter(Boolean) as Img[];
  if (photos.length) {
    const COL_AT = [0.1, 2.6, 5.6], ROWS = 9;   // x ≈ 5px, 320px, 640px; each photo ≤ 230×165 px over 9 rows of 20 px
    for (let i = 0; i < photos.length; i += 3) {
      for (let k = r; k < r + ROWS; k++) ws.getRow(k).height = 15;
      photos.slice(i, i + 3).forEach((img, j) =>
        ws.addImage(wb.addImage({ buffer: img.data as any, extension: img.format === "jpg" ? "jpeg" : "png" }), { tl: { col: COL_AT[j], row: r - 1 + 0.15 }, ext: fit(img, 230, 165) }));
      r += ROWS;
    }
    merge(`A${r}:I${r}`); put(`A${r}`, q.imageCaption || "Images are for illustrative purpose only", { font: { size: 7, italic: true } }); r += 2;
  }

  // terms (left) + totals (right)
  const termsTop = r;
  merge(`A${r}:E${r}`); put(`A${r}`, "TERMS AND CONDITIONS", { font: { bold: true, color: { argb: "FFFFFFFF" }, size: 8 }, fill: BLUE });
  (q.terms ?? []).forEach((tm: any, i: number) => { merge(`A${r + 1 + i}:E${r + 1 + i}`); put(`A${r + 1 + i}`, `${i + 1}.${tm.label ? tm.label + " : " : ""}${tm.value}`, { font: { size: 8.5 } }); ws.getRow(r + 1 + i).height = tm.value.length > 62 ? 24 : 14; });
  const sub = termsTop, rate = q.gstRate ?? t.gstRate ?? 18;
  const rows: [string, string, number][] = t.supply === "inter"
    ? [["Subtotal", `SUM(I${first}:I${last})`, t.subtotal], [`IGST ${rate}%`, `ROUND(I${sub}*${rate}/100,2)`, t.igst]]
    : [["Subtotal", `SUM(I${first}:I${last})`, t.subtotal], [`CGST ${rate / 2}%`, `ROUND(I${sub}*${rate}/200,2)`, t.cgst], [`SGST ${rate / 2}%`, `ROUND(I${sub}*${rate}/200,2)`, t.sgst]];
  rows.forEach(([k, f, v], i) => { const rr = sub + i; merge(`F${rr}:H${rr}`); put(`F${rr}`, k, { font: { bold: true } }); ws.getCell(`I${rr}`).value = { formula: f, result: v }; put(`I${rr}`, ws.getCell(`I${rr}`).value, { align: "right", fmt: money, font: { bold: i === 0 } }); });
  const rof = sub + rows.length, tot = rof + 1;
  merge(`F${rof}:H${rof}`); put(`F${rof}`, "ROF(+/-)", { font: { bold: true } });
  ws.getCell(`I${rof}`).value = { formula: `ROUND(SUM(I${sub}:I${rof - 1}),0)-SUM(I${sub}:I${rof - 1})`, result: t.roundOff }; put(`I${rof}`, ws.getCell(`I${rof}`).value, { align: "right", fmt: money });
  merge(`F${tot}:H${tot}`); put(`F${tot}`, "TOTAL", { font: { bold: true, size: 10 }, fill: GOLD });
  ws.getCell(`I${tot}`).value = { formula: `SUM(I${sub}:I${rof})`, result: t.total }; put(`I${tot}`, ws.getCell(`I${tot}`).value, { align: "right", fmt: money, font: { bold: true, size: 10 }, fill: GOLD });
  merge(`F${tot + 1}:I${tot + 3}`); put(`F${tot + 1}`, `Amount in Words(Rupees): ${(t.words ?? "").replace(/^Rupees /, "")}`, { font: { size: 8.5, bold: true }, align: "left" }).alignment = { wrapText: true, vertical: "top" };

  r = Math.max(termsTop + (q.terms?.length ?? 0), tot + 3) + 3;
  merge(`A${r}:J${r}`); put(`A${r}`, "If you have any questions about this price quote, please contact", { align: "center" }); r++;
  if (q.preparedBy?.name) { merge(`A${r}:J${r}`); put(`A${r}`, `${q.preparedBy.name}${q.preparedBy.phone ? " - " + q.preparedBy.phone : ""}`, { align: "center", font: { bold: true } }); r++; }
  merge(`A${r}:J${r}`); put(`A${r}`, "Thank You For Your Business!", { align: "center", font: { bold: true, italic: true, size: 10 } });
  ws.pageSetup.printArea = `A1:J${r}`;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Internal costing workbook for a quotation: one sheet per BOM package line (never customer-facing) */
export async function buildCostingWorkbook(q: any): Promise<Buffer> {
  const pk = (q.lines ?? []).filter((l: any) => l.bom?.items?.length);
  if (!pk.length) { const wb = new ExcelJS.Workbook(); wb.addWorksheet("Costing").getCell("A1").value = "No BOM packages on this quotation."; return Buffer.from(await wb.xlsx.writeBuffer()); }
  return buildBomWorkbook(pk.map((l: any) => ({ title: l.bom.name || l.description, date: l.bom.date, subtitle: `Quotation ${displayNumber(q)} · quoted at Rs. ${Number(l.basicPrice).toLocaleString("en-IN")} × ${l.qty}`, bom: l.bom })));
}
