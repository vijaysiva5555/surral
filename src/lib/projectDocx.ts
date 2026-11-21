/* eslint-disable @typescript-eslint/no-explicit-any */
/* The project quotation as an editable Word document (.docx) – the same letter, tables, images and terms as the PDF
   (src/components/pdf/ProjectQuotePdf.tsx), built from real Word paragraphs, tables and bullets so it can be changed
   in Word, Google Docs or LibreOffice before it is sent. */
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table,
  TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType, type IBorderOptions,
} from "docx";
import { inr } from "@/lib/format";
import { fit } from "@/lib/imageSize";
import { loadBranding, loadImage, type Img } from "@/lib/branding";

const NAVY = "0B2C4D", LINE = "B6C2CE", SOFT = "F4F8FB", MUTED = "55657A";
const FONT = "Arial";
const SIZE = 18;            // half-points: 9 pt body text
/** A4 with 0.5" margins: 11906 − 2 × 720 twips of text width; the PDF's 535 pt columns are scaled to it */
const PAGE_W = 11906, MARGIN = 720, W = PAGE_W - 2 * MARGIN;
const k = W / 535;
const COL = { sno: Math.round(32 * k), desc: Math.round(265 * k), qty: Math.round(58 * k), unit: Math.round(90 * k) };
const COL_TOTAL = W - COL.sno - COL.desc - COL.qty - COL.unit;

type Run = { text: string; bold?: boolean; italics?: boolean; color?: string; size?: number };
const run = (r: Run | string) => (typeof r === "string" ? new TextRun({ text: r, font: FONT, size: SIZE }) : new TextRun({ text: r.text, bold: r.bold, italics: r.italics, color: r.color, size: r.size ?? SIZE, font: FONT }));
/** one paragraph; a text with line breaks keeps them */
function p(content: string | Run | (string | Run)[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; keepNext?: boolean; bullet?: boolean; line?: number } = {}) {
  const parts = Array.isArray(content) ? content : [content];
  const children: TextRun[] = [];
  for (const part of parts) {
    const r: Run = typeof part === "string" ? { text: part } : part;
    String(r.text ?? "").split("\n").forEach((line, i) => children.push(i === 0 ? run({ ...r, text: line }) : new TextRun({ text: line, break: 1, bold: r.bold, italics: r.italics, color: r.color, size: r.size ?? SIZE, font: FONT })));
  }
  return new Paragraph({ children, alignment: o.align, keepNext: o.keepNext, spacing: { before: o.before ?? 0, after: o.after ?? 0, line: o.line }, ...(o.bullet ? { bullet: { level: 0 } } : {}) });
}
const heading = (text: string, before = 240) => p({ text, bold: true, color: NAVY, size: 19 }, { before, after: 80, keepNext: true });

const edge: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const GRID = { top: edge, bottom: edge, left: edge, right: edge, insideHorizontal: edge, insideVertical: edge };
const NO_GRID = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

type CellOpt = { w: number; span?: number; head?: boolean; shade?: boolean; align?: "center" | "right"; bold?: boolean };
function cell(content: string | Run | (string | Run)[] | Paragraph[], o: CellOpt) {
  const align = o.align === "center" ? AlignmentType.CENTER : o.align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const children = Array.isArray(content) && content[0] instanceof Paragraph ? (content as Paragraph[])
    : [p(o.head ? { text: String(content), bold: true, color: NAVY, size: 17 } : o.bold && typeof content === "string" ? { text: content, bold: true } : (content as any), { align })];
  return new TableCell({
    width: { size: o.w, type: WidthType.DXA }, columnSpan: o.span, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: o.head || o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: SOFT } : undefined,
    children,
  });
}
const table = (widths: number[], rows: TableRow[], borders = GRID) => new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, borders, rows });
const row = (cells: TableCell[], o: { header?: boolean } = {}) => new TableRow({ children: cells, cantSplit: true, tableHeader: o.header });

const qtyNum = (q: string) => { const n = parseFloat(String(q).replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? n : 1; };
const lineTotal = (l: any) => qtyNum(l.qty) * (Number(l.unitPrice) || 0);
function dmy(d: string | Date | undefined) {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}.${String(x.getUTCMonth() + 1).padStart(2, "0")}.${x.getUTCFullYear()}`;
}
/** Word sizes images in pixels at 96 dpi; 1 pt = 4/3 px */
const image = (img: Img, maxWpt: number, maxHpt: number) => { const s = fit(img, maxWpt * 4 / 3, maxHpt * 4 / 3); return new ImageRun({ type: img.format, data: img.data, transformation: { width: Math.round(s.width), height: Math.round(s.height) } }); };

const priceHead = () => row([cell("S.No.", { w: COL.sno, head: true, align: "center" }), cell("Description", { w: COL.desc, head: true }), cell("Qty.", { w: COL.qty, head: true, align: "center" }), cell("Unit Price in Rs.", { w: COL.unit, head: true, align: "right" }), cell("Total Price in Rs.", { w: COL_TOTAL, head: true, align: "right" })], { header: true });
const priceRow = (no: number, l: any, boldTotal = false) => row([
  cell(String(no), { w: COL.sno, align: "center" }), cell(l.description ?? "", { w: COL.desc }), cell(l.qty ?? "", { w: COL.qty, align: "center" }),
  cell(inr(Number(l.unitPrice) || 0), { w: COL.unit, align: "right" }), cell(boldTotal ? { text: inr(lineTotal(l)), bold: true } : inr(lineTotal(l)), { w: COL_TOTAL, align: "right" }),
]);
const PRICE_COLS = [COL.sno, COL.desc, COL.qty, COL.unit, COL_TOTAL];

export function buildProjectQuoteDocx(q: any, logo: Img | null, offerImages: Img[][] = []): Document {
  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const offers: any[] = q.offers ?? [];
  const body: (Paragraph | Table)[] = [];
  const gap = (after = 120) => new Paragraph({ spacing: { after }, children: [] });

  // ---- letterhead: logo | company name, tagline, address | (balance) ----
  const addr: string[] = co.addressLines ?? [];
  const side = Math.round(W * 0.13);
  body.push(table([side, W - 2 * side, side], [row([
    new TableCell({ width: { size: side, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: logo ? [image(logo, 56, 54)] : [] })] }),
    new TableCell({ width: { size: W - 2 * side, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [
      p({ text: co.name ?? "", bold: true, italics: true, color: NAVY, size: 34 }, { align: AlignmentType.CENTER }),
      ...(co.tagline ? [p({ text: co.tagline, color: MUTED, size: 15 }, { align: AlignmentType.CENTER, before: 40 })] : []),
      ...(addr.length ? [p({ text: `${addr.join(", ")}${co.gstin ? `  ·  GSTIN ${co.gstin}` : ""}`, color: MUTED, size: 14 }, { align: AlignmentType.CENTER, before: 30 })] : []),
    ] }),
    new TableCell({ width: { size: side, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
  ])], { ...NO_GRID, bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY } }));
  body.push(gap(200));

  // ---- letter ----
  const LAB = Math.round(W * 0.19);
  const meta = (label: string, value: string | Run) => row([cell({ text: label, bold: true, color: NAVY }, { w: LAB }), cell(value, { w: W - LAB })]);
  const custLines: string[] = (cu.addressLines ?? []).map((l: string, i: number, all: string[]) => (i === all.length - 1 && cu.pincode && !String(l).includes(cu.pincode) ? `${l} - ${cu.pincode}` : l));
  body.push(table([LAB, W - LAB], [
    meta("Date: -", dmy(q.date)),
    meta("Customer Name: -", { text: cu.name ?? "", bold: true }),
    ...custLines.map((l) => meta("", l)),
    meta("Kind Attn: -", `${cu.contact?.name ?? ""}${cu.contact?.phone ? ` (${cu.contact.phone})` : ""}`),
    meta("Offer Ref: -", { text: q.number ?? "", bold: true }),
  ].map((r) => r), NO_GRID));
  if (q.subject) body.push(p({ text: `Subject: ${q.subject}`, bold: true }, { before: 120 }));
  body.push(p(q.intro || `As discussed with you we offered for ${q.subject || "the system"}. Please go through same.`, { before: 200, align: AlignmentType.JUSTIFIED, line: 360 }));

  body.push(p("Yours faithfully,", { before: 240 }));
  body.push(p([{ text: "For ", bold: true }, { text: co.name ?? "", bold: true, italics: true }, { text: ",", bold: true }], { before: 200 }));
  if (q.signerName) body.push(p({ text: q.signerName, bold: true }, { before: 200 }));
  if (q.signerPhone) body.push(p({ text: q.signerPhone, size: 16 }));
  if (q.signerEmail) body.push(p({ text: q.signerEmail, size: 16 }));
  body.push(gap(160));

  // ---- summary ----
  const sw = [Math.round(150 * k), Math.round(175 * k), Math.round(110 * k)];
  const summary = [...sw, W - sw[0] - sw[1] - sw[2]];
  body.push(table(summary, [
    row(["Name", "Modifications", "Quotation No", "Date"].map((h, i) => cell(h, { w: summary[i], head: true }))),
    row([cell("", { w: summary[0] }), cell("", { w: summary[1] }), cell({ text: q.number ?? "", bold: true }, { w: summary[2] }), cell(dmy(q.date), { w: summary[3] })]),
    row([cell(["Prepared by: ", { text: q.preparedBy || q.createdByName || "-", bold: true }], { w: summary[0] + summary[1], span: 2 }), cell(["Approved by: ", { text: q.approvedBy || "-", bold: true }], { w: summary[2] + summary[3], span: 2 })]),
  ]));

  // ---- equipment: Graco | Surral side by side ----
  const graco: string[] = q.equipmentGraco ?? [], surral: string[] = q.equipmentSurral ?? [];
  if (graco.length || surral.length) {
    body.push(gap(160));
    const half = Math.round(W / 2);
    const list = (items: string[]) => (items.length ? items.map((x) => p(x, { bullet: true, line: 300 })) : [p("")]);
    body.push(table([half, W - half], [
      row([cell("Details: Graco Equipment’s", { w: half, head: true }), cell("Details: Surral Equipment’s", { w: W - half, head: true })]),
      new TableRow({ children: [
        new TableCell({ width: { size: half, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 90, right: 90 }, children: list(graco) }),
        new TableCell({ width: { size: W - half, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 90, right: 90 }, children: list(surral) }),
      ] }),
    ]));
  }

  // ---- technical specs ----
  if (q.technicalTitle) body.push(heading(`TECHNICAL DESCRIPTION: - ${q.technicalTitle}`));
  const specs: any[] = q.specs ?? [];
  if (specs.length) {
    if (!q.technicalTitle) body.push(gap(160));
    const a = Math.round(215 * k);
    body.push(table([a, W - a], [
      row([cell("Technical Specifications", { w: W, span: 2, head: true })], { header: true }),
      ...specs.map((sp) => row([cell(sp.label ?? "", { w: a }), cell(sp.value ?? "", { w: W - a })])),
    ]));
  }

  // ---- offers ----
  offers.forEach((o, oi) => {
    body.push(o.title ? heading(o.title) : gap(200));
    body.push(table(PRICE_COLS, [priceHead(), ...(o.items ?? []).map((l: any, i: number) => priceRow(i + 1, l, true))]));
    const consists: any[] = o.consists ?? [];
    if (consists.length) {
      body.push(p({ text: "Graco Supply Consists of: -", bold: true }, { before: 140, after: 60, keepNext: true }));
      const cw = [COL.sno, COL.desc + COL.unit, COL.qty + COL_TOTAL];
      body.push(table(cw, [
        row([cell("S.No.", { w: cw[0], head: true, align: "center" }), cell("Description", { w: cw[1], head: true }), cell("Qty.", { w: cw[2], head: true, align: "center" })], { header: true }),
        ...consists.map((c, i) => row([cell(String(i + 1), { w: cw[0], align: "center" }), cell(c.description ?? "", { w: cw[1] }), cell(c.qty ?? "", { w: cw[2], align: "center" })])),
      ]));
    }
    // images: two per row, each kept whole
    const imgs = offerImages[oi] ?? [];
    if (imgs.length) {
      body.push(gap(120));
      const half = Math.round(W / 2);
      const rows: TableRow[] = [];
      for (let i = 0; i < imgs.length; i += 2) {
        rows.push(row([imgs[i], imgs[i + 1]].map((img, j) => new TableCell({
          width: { size: j === 0 ? half : W - half, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: img ? [image(img, 250, 180)] : [] })],
        }))));
      }
      body.push(table([half, W - half], rows, NO_GRID));
    }
  });

  // ---- offer total ----
  body.push(heading("OFFER TOTAL"));
  let n = 0;
  const allLines = offers.flatMap((o) => (o.items ?? []).map((l: any) => ({ no: ++n, l })));
  const left = COL.sno + COL.desc + COL.qty + COL.unit;
  body.push(table(PRICE_COLS, [
    priceHead(),
    ...allLines.map(({ no, l }) => priceRow(no, l)),
    row([cell({ text: "Total", bold: true }, { w: left, span: 4, align: "right", shade: true }), cell({ text: inr(t.total ?? 0), bold: true }, { w: COL_TOTAL, align: "right", shade: true })]),
    row([cell({ text: `Rupees: ${String(t.words ?? "").replace(/^Rupees /, "")}`, bold: true }, { w: left, span: 4 }), cell("", { w: COL_TOTAL })]),
  ]));
  body.push(p({ text: t.gstNote || "GST 18% Extra", bold: true }, { before: 80 }));

  // ---- exclusions ----
  const exclusions: string[] = q.exclusions ?? [];
  if (exclusions.length) {
    body.push(heading("Exclusions: -"));
    for (const x of exclusions) body.push(p(x, { bullet: true, line: 300 }));
  }

  // ---- terms ----
  body.push(heading("TERMS & CONDITIONS: -"));
  body.push(p("Above-mentioned prices are Ex, Chennai. Order to be placed on"));
  body.push(p([{ text: "M/s. ", bold: true }, { text: co.name ?? "", bold: true, italics: true }, { text: ",", bold: true }], { before: 40 }));
  for (const l of addr) body.push(p(l));
  if (co.gstin) body.push(p(`GSTIN: - ${co.gstin}`));
  if (co.email) body.push(p(`E-Mail: - ${co.email}`));
  for (const tm of q.terms ?? []) {
    body.push(p({ text: `${String(tm.label ?? "").toUpperCase()}: -`, bold: true, color: NAVY }, { before: 140, after: 40, keepNext: true }));
    for (const line of String(tm.value ?? "").split(/\n+/).filter(Boolean)) body.push(p(line, { bullet: true, line: 300 }));
  }

  // ---- running header (from page 2) and footer ----
  const half = Math.round(W / 2);
  const header = new Header({ children: [table([half, W - half], [row([
    cell({ text: co.name ?? "", bold: true, italics: true, size: 16 }, { w: half }),
    cell({ text: `${q.number ?? ""} · ${cu.name ?? ""}`, size: 16 }, { w: W - half, align: "right" }),
  ])], { ...NO_GRID, bottom: edge }), new Paragraph({ spacing: { after: 120 }, children: [] })] });
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
    new TextRun({ text: `${q.number ?? ""}  ·  Page `, size: 14, color: MUTED, font: FONT }),
    new TextRun({ children: [PageNumber.CURRENT], size: 14, color: MUTED, font: FONT }),
    new TextRun({ text: " of ", size: 14, color: MUTED, font: FONT }),
    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: MUTED, font: FONT }),
  ] })] });

  return new Document({
    creator: co.name ?? "", title: `Project Quotation ${q.number ?? ""}`,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{
      properties: { titlePage: true, page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 720, bottom: 720, left: MARGIN, right: MARGIN, header: 400, footer: 400 } } },
      headers: { first: new Header({ children: [] }), default: header },
      footers: { first: footer, default: footer },
      children: body,
    }],
  });
}

export async function renderProjectQuoteDocx(q: any): Promise<Buffer> {
  const [{ logo }, offerImages] = await Promise.all([
    loadBranding(),
    Promise.all((q.offers ?? []).map(async (o: any) => (await Promise.all((o.images ?? []).map(loadImage))).filter(Boolean) as Img[])),
  ]);
  return Packer.toBuffer(buildProjectQuoteDocx(q, logo, offerImages));
}
