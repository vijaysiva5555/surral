/* eslint-disable @typescript-eslint/no-explicit-any */
/* The project quotation as an editable Word document (.docx), laid out like the company's own project offer
   (e.g. "3136 - Adicoat.docx"): a cover page, then pages with the letterhead banner on top and the Web / E-Mail line
   at the bottom – the letter with the summary table, one TECHNICAL DESCRIPTION per item (spec table with the photo
   beside it), the COMMERCIAL OFFER (each offer on its own page with Graco and Surral supply lists), the OFFER TOTAL,
   exclusions, TERMS & CONDITIONS and the warranty. Everything is real Word text, tables and bullets, so it can be
   changed in Word before it is sent. */
import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HorizontalPositionRelativeFrom, ImageRun,
  LevelFormat, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopType, TextRun,
  TextWrappingType, VerticalAlign, VerticalPositionRelativeFrom, WidthType, type IBorderOptions,
} from "docx";
import { inr } from "@/lib/format";
import { fit, imageSize } from "@/lib/imageSize";
import { loadBranding, loadImage, type Img } from "@/lib/branding";
import { INLINE_TERMS, PAGE_TERMS, lineAmount, technicalsOf } from "@/lib/projectQuote";

// ---- page and type ----
const PAGE_W = 12240, PAGE_H = 15840;          // US Letter, as the company's template
const MARGIN = 1440, W = PAGE_W - 2 * MARGIN;  // 6.5" of text width
const BLUE = "0070C0", GREEN = "D6E3BC", LINE_BLUE = "4BACC6";
const ARIAL = "Arial", GOTHIC = "Century Gothic", TIMES = "Times New Roman";
const EMU = 914400;                            // per inch, for floating pictures

type Run = { text: string; bold?: boolean; italics?: boolean; color?: string; size?: number; font?: string; highlight?: boolean; underline?: boolean };
const run = (r: Run | string, base: Partial<Run> = {}) => {
  const x: Run = typeof r === "string" ? { text: r, ...base } : { ...base, ...r };
  return new TextRun({ text: x.text, bold: x.bold, italics: x.italics, color: x.color, size: x.size ?? 22, font: x.font ?? ARIAL, highlight: x.highlight ? "yellow" : undefined, underline: x.underline ? {} : undefined });
};
type POpt = { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; line?: number; indent?: number; hanging?: number; firstLine?: number; keepNext?: boolean; pageBreak?: boolean; bullet?: "arrow" | "square" | "diamond"; level?: number; base?: Partial<Run> };
function p(content: string | Run | (string | Run | ExternalHyperlink)[], o: POpt = {}) {
  const parts = Array.isArray(content) ? content : [content];
  return new Paragraph({
    children: parts.map((x) => (x instanceof ExternalHyperlink ? x : run(x as Run | string, o.base))),
    alignment: o.align, keepNext: o.keepNext, pageBreakBefore: o.pageBreak,
    spacing: { before: o.before ?? 0, after: o.after ?? 0, line: o.line },
    indent: o.indent != null || o.hanging != null || o.firstLine != null ? { left: o.indent, hanging: o.hanging, firstLine: o.firstLine } : undefined,
    numbering: o.bullet ? { reference: o.bullet, level: o.level ?? 0 } : undefined,
  });
}
const blank = (after = 0) => new Paragraph({ spacing: { after }, children: [] });
const link = (text: string, url: string, r: Partial<Run> = {}) => new ExternalHyperlink({ link: url, children: [new TextRun({ text, style: "Hyperlink", font: r.font ?? ARIAL, size: r.size ?? 22, bold: r.bold })] });
const heading = (text: string, o: POpt = {}) => p({ text, bold: true, color: BLUE, size: 24 }, { before: 240, after: 120, keepNext: true, ...o });

const edge: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const GRID = { top: edge, bottom: edge, left: edge, right: edge, insideHorizontal: edge, insideVertical: edge };
const NO_GRID = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

type COpt = { w: number; span?: number; fill?: string; align?: "center" | "right" | "left"; v?: "top" | "center"; pad?: number; run?: Partial<Run>; borders?: any };
function cell(content: string | Run | (string | Run)[] | (Paragraph | Table)[], o: COpt) {
  const align = o.align === "center" ? AlignmentType.CENTER : o.align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const children = Array.isArray(content) && (content[0] instanceof Paragraph || content[0] instanceof Table) ? (content as (Paragraph | Table)[]) : [p(content as any, { align, base: o.run })];
  const pad = o.pad ?? 80;
  return new TableCell({
    width: { size: o.w, type: WidthType.DXA }, columnSpan: o.span,
    verticalAlign: o.v === "top" ? VerticalAlign.TOP : VerticalAlign.CENTER,
    margins: { top: 30, bottom: 30, left: pad, right: pad },
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    borders: o.borders,
    children,
  });
}
const table = (widths: number[], rows: TableRow[], borders: any = GRID) =>
  new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, borders, rows });
const row = (cells: TableCell[], o: { header?: boolean; height?: number } = {}) => new TableRow({ children: cells, cantSplit: true, tableHeader: o.header, height: o.height ? { value: o.height, rule: "atLeast" as any } : undefined });

/** a picture sized in points (Word wants pixels at 96 dpi: 1 pt = 4/3 px) */
const picture = (img: Img, maxWpt: number, maxHpt: number) => { const s = fit(img, maxWpt * 4 / 3, maxHpt * 4 / 3); return new ImageRun({ type: img.format, data: img.data, transformation: { width: Math.round(s.width), height: Math.round(s.height) } }); };
/** a picture placed on the page at an exact spot (inches from the page's top-left corner) */
const floating = (img: Img, x: number, y: number, w: number, h: number, behind = false) => new ImageRun({
  type: img.format, data: img.data, transformation: { width: Math.round(w * 96), height: Math.round(h * 96) },
  floating: {
    horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(x * EMU) },
    verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(y * EMU) },
    behindDocument: behind, allowOverlap: true, wrap: { type: TextWrappingType.NONE }, zIndex: behind ? 0 : 1,
  },
});
function publicImage(file: string): Img | null {
  try { const data = fs.readFileSync(path.join(process.cwd(), "public", file)); return { data, format: file.endsWith(".png") ? "png" : "jpg", ...imageSize(data) }; } catch { return null; }
}

function dmy(d: string | Date | undefined) {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}.${String(x.getUTCMonth() + 1).padStart(2, "0")}.${x.getUTCFullYear()}`;
}
const url = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);
const upper = (s: string) => String(s ?? "").toUpperCase();

export type DocxImages = { logo: Img | null; cover: Img | null; offers: Img[][]; technicals: (Img | null)[] };

export function buildProjectQuoteDocx(q: any, images: DocxImages): Document {
  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const offers: any[] = q.offers ?? [], extras: any[] = q.extras ?? [], technicals = technicalsOf(q);
  const coName: string = co.name ?? "";
  const email: string = co.email ?? "", website: string = co.website ?? "";
  const letterhead = publicImage("docx/letterhead.png"), decor = publicImage("docx/cover-decor.png");

  // =================== cover page ===================
  const cover: (Paragraph | Table)[] = [];
  const anchors: ImageRun[] = [];
  if (decor) anchors.push(floating(decor, 0, 0, 8.5, 11, true));
  if (images.cover) {
    const box = { x: 0.58, y: 3.97, w: 7.63, h: 6.9 }, s = fit(images.cover, box.w, box.h);
    anchors.push(floating(images.cover, box.x + (box.w - s.width) / 2, box.y + (box.h - s.height) / 2, s.width, s.height));
  }
  cover.push(new Paragraph({ children: anchors }));
  const COVER_W = PAGE_W - 1200, LOGO_COL = 900, GAP_COL = 3300, NAME_COL = COVER_W - GAP_COL - LOGO_COL;   // logo about 3.2" from the left edge, as in the template
  cover.push(table([GAP_COL, LOGO_COL, NAME_COL], [row([
    cell("", { w: GAP_COL }),
    cell(images.logo ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [picture(images.logo, 44, 46)] })] : "", { w: LOGO_COL, pad: 40 }),
    cell([
      p({ text: upper(coName).replace(/\.$/, ""), bold: true, italics: true, color: BLUE, size: 32 }, { align: AlignmentType.CENTER }),
      p({ text: "Designing, Drafting, Manufacturing, Installation and Commissioning of", font: TIMES, size: 22 }, { align: AlignmentType.CENTER }),
      ...(q.systemName ? [p({ text: q.systemName, font: TIMES, size: 22 }, { align: AlignmentType.CENTER })] : []),
    ], { w: NAME_COL, pad: 40 }),
  ])], NO_GRID));

  // =================== letter ===================
  const body: (Paragraph | Table)[] = [];
  const L = { bold: true, size: 24 };            // letter labels: bold 12 pt
  const LABEL_W = 2160;                          // where the customer's name and address start
  body.push(p([{ text: "Date: - ", ...L }, { text: dmy(q.date), ...L }], { after: 280 }));
  const addr: string[] = (cu.addressLines ?? []).map((l: string, i: number, all: string[]) => (i === all.length - 1 && cu.pincode && !String(l).includes(cu.pincode) ? `${l} - ${cu.pincode}` : l));
  body.push(p([{ text: "Customer Name: - ", ...L }, { text: cu.name ?? "", ...L }]));
  for (const a of addr) body.push(p({ text: a, ...L }, { indent: LABEL_W }));
  body.push(blank(280));
  if (cu.contact?.name || cu.contact?.phone) {
    body.push(p([{ text: "Kind Attn: - ", ...L }, { text: cu.contact?.name ?? "", ...L }]));
    if (cu.contact?.phone) body.push(p({ text: `(${cu.contact.phone})`, size: 24 }, { indent: 1500 }));
    body.push(blank(280));
  }
  body.push(p([{ text: "Offer Ref: - ", ...L }, { text: q.number ?? "", size: 24 }], { after: 560 }));
  if (q.subject) body.push(p([{ text: "Subject: ", ...L }, { text: q.subject, size: 24 }], { after: 480 }));
  body.push(p({ text: "Dear Sir,", ...L }, { after: 280 }));
  body.push(p(q.intro || `As discussed with you we offered for ${q.subject || "the system"}. Please go through same.`, { firstLine: 960, after: 840, line: 276 }));
  body.push(p({ text: "Yours faithfully,", font: GOTHIC, size: 24 }));
  body.push(p([{ text: "For ", font: GOTHIC, size: 24 }, { text: `${upper(coName).replace(/\.$/, "")}.,`, bold: true, size: 24 }]));
  if (q.signerName) body.push(p({ text: q.signerName, bold: true, size: 24 }));
  if (q.signerPhone) body.push(p({ text: q.signerPhone, bold: true, size: 24 }));
  if (q.signerEmail) body.push(new Paragraph({ children: [link(q.signerEmail, `mailto:${q.signerEmail}`, { bold: true, size: 24 })] }));
  body.push(blank(360));

  // summary table: name / modifications / number / date, prepared & approved, the two equipment lists
  const SW = [2400, 2300, 3100, 1560];
  const g = { font: GOTHIC, size: 22 };
  const equip = (title: string, items: string[]) => [p({ text: title, bold: true, ...g }), ...(items.length ? items.map((x) => p({ text: x, size: 22 }, { bullet: "square" })) : [blank()])];
  body.push(table(SW, [
    row(["Name", "Modifications", "Quotation No", "Date"].map((h, i) => cell({ text: h, bold: true, ...g, size: 24 }, { w: SW[i], align: "center" }))),
    row([cell("", { w: SW[0] }), cell("", { w: SW[1] }), cell({ text: q.number ?? "", ...g }, { w: SW[2] }), cell({ text: dmy(q.date), bold: true, ...g }, { w: SW[3] })]),
    row([cell("", { w: SW[0] }), cell("", { w: SW[1] }), cell("", { w: SW[2] }), cell("", { w: SW[3] })], { height: 300 }),
    row([cell([{ text: "Prepared by: ", bold: true, ...g }, { text: q.preparedBy || q.createdByName || "", ...g }], { w: SW[0] + SW[1], span: 2 }), cell([{ text: "Approved by: ", bold: true, ...g }, { text: q.approvedBy || "", ...g }], { w: SW[2] + SW[3], span: 2 })]),
    row([cell(equip("Details: Graco Equipment’s", q.equipmentGraco ?? []), { w: SW[0] + SW[1], span: 2, v: "top" }), cell(equip("Details: Surral Equipment’s", q.equipmentSurral ?? []), { w: SW[2] + SW[3], span: 2, v: "top" })], { height: 1500 }),
  ]));

  // =================== technical descriptions ===================
  const SPEC_W = 5800, PHOTO_W = W - SPEC_W, SPEC_COL = [2900, 2900];
  technicals.forEach((tech, ti) => {
    body.push(p([{ text: "TECHNICAL DESCRIPTION: - ", bold: true, color: BLUE, size: 24 }, { text: tech.title ?? "", size: 22 }], { before: ti === 0 ? 0 : 480, after: 200, keepNext: true, pageBreak: ti === 0 }));
    const c = { size: 22 };
    const specTable = table(SPEC_COL, [
      row([cell({ text: "Technical Specifications", bold: true, color: "FFFFFF", size: 32 }, { w: SPEC_W - 100, span: 2, fill: BLUE, align: "center" })], { header: true }),
      ...(tech.specs ?? []).map((s) => row([cell({ text: s.label ?? "", ...c }, { w: SPEC_COL[0], align: "center" }), cell({ text: s.value ?? "", ...c }, { w: SPEC_COL[1], align: "center" })])),
      row([cell({ text: "Image is for illustrative purposes only.", ...c }, { w: SPEC_W - 100, span: 2, align: "center" })]),
    ]);
    const img = images.technicals[ti];
    body.push(table([SPEC_W, PHOTO_W], [row([
      cell([specTable], { w: SPEC_W, pad: 0, v: "top" }),
      cell(img ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [picture(img, 160, 210)] })] : "", { w: PHOTO_W, pad: 120 }),
    ])], NO_GRID));
  });

  // =================== commercial offer ===================
  const OW = [800, 3700, 800, 1900, 2160];
  const head = (labels: string[], widths: number[]) => row(labels.map((h, i) => cell({ text: h, bold: true, font: GOTHIC, size: 22 }, { w: widths[i], fill: GREEN, align: "center" })), { header: true, height: 560 });
  const priceRow = (no: string, l: any) => row([
    cell({ text: no, size: 24 }, { w: OW[0], align: "center" }), cell({ text: l.description ?? "", size: 24 }, { w: OW[1] }), cell({ text: l.qty ?? "", size: 24 }, { w: OW[2], align: "center" }),
    cell({ text: inr(Number(l.unitPrice) || 0), size: 24 }, { w: OW[3], align: "right" }), cell({ text: inr(lineAmount(l)), size: 24 }, { w: OW[4], align: "right" }),
  ], { height: 460 });
  const offerRef = () => p([{ text: "Offer Ref: - ", bold: true }, { text: q.number ?? "" }], { bullet: "diamond", after: 360 });
  const CW = [800, W - 1800, 1000];
  const supplyRows = (list: any[], oi: number, from: number) => list.map((c2, k) => row([
    cell({ text: `${oi + 1}.${from + k + 1}`, size: 22 }, { w: CW[0], align: "center" }), cell({ text: c2.description ?? "", size: 22 }, { w: CW[1] }), cell({ text: c2.qty ?? "", size: 22 }, { w: CW[2], align: "center" }),
  ]));
  offers.forEach((o, oi) => {
    if (oi === 0) { body.push(heading("COMMERCIAL OFFER", { before: 0, after: 80, pageBreak: true })); body.push(offerRef()); }
    if (o.title) body.push(p({ text: o.title, bold: true, highlight: true, font: GOTHIC, size: 22 }, { after: 200, keepNext: true, pageBreak: oi > 0 }));
    else if (oi > 0) body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    const items: any[] = o.items ?? [];
    body.push(table(OW, [head(["S.No.", "Description", "Qty.", "Unit Price in Rs.", "Total Price in Rs."], OW), ...items.map((l, ii) => priceRow(items.length > 1 ? `${oi + 1}.${ii + 1}` : String(oi + 1), l))]));
    const graco: any[] = (o.consists ?? []).filter((c2: any) => c2.description || c2.qty), surral: any[] = (o.surralConsists ?? []).filter((c2: any) => c2.description || c2.qty);
    if (graco.length) {
      body.push(heading("Graco Supply Consists of: -", { before: 400 }));
      body.push(table(CW, [row([cell({ text: "S.No:", size: 22 }, { w: CW[0] }), cell({ text: "Description", size: 22 }, { w: CW[1], align: "center" }), cell({ text: "Qty.", size: 22 }, { w: CW[2], align: "center" })], { header: true }), ...supplyRows(graco, oi, 0)]));
    }
    if (surral.length) {
      body.push(heading("Surral Supply Consists of: -", { before: 400 }));
      body.push(table(CW, supplyRows(surral, oi, graco.length)));
    }
    const pics = images.offers[oi] ?? [];
    if (pics.length) {
      body.push(blank(200));
      const half = Math.round(W / 2), rows: TableRow[] = [];
      for (let i = 0; i < pics.length; i += 2) rows.push(row([pics[i], pics[i + 1]].map((img, j) => cell(img ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [picture(img, 230, 170)] })] : "", { w: j === 0 ? half : W - half, pad: 80 }))));
      body.push(table([half, W - half], rows, NO_GRID));
    }
  });

  // =================== offer total ===================
  body.push(heading("OFFER TOTAL", { before: 0, after: 80, pageBreak: true }));
  body.push(offerRef());
  let n = 0;
  const totalLines = [...offers.flatMap((o) => o.items ?? []), ...extras];
  const words = String(t.words ?? "").replace(/^Rupees\s*/i, "").replace(/\.?$/, ".");
  body.push(table(OW, [
    head(["S.No.", "Description", "Qty.", "Unit Price in Rs.", "Total Price in Rs."], OW),
    ...totalLines.map((l) => priceRow(String(++n), l)),
    row([cell({ text: "Total", bold: true, size: 26, highlight: true }, { w: OW[0] + OW[1] + OW[2] + OW[3], span: 4, align: "right" }), cell({ text: inr(t.total ?? 0), bold: true, size: 26, highlight: true }, { w: OW[4], align: "right" })]),
    row([cell({ text: `Rupees: ${words}`, bold: true, size: 28, highlight: true }, { w: W, span: 5 })], { height: 500 }),
  ]));
  body.push(p({ text: t.gstNote || "GST 18% Extra", bold: true, highlight: true }, { before: 400, after: 480 }));

  const exclusions: string[] = q.exclusions ?? [];
  if (exclusions.length) {
    body.push(heading("Exclusions: -", { before: 240 }));
    for (const x of exclusions) body.push(p(x, { bullet: "arrow" }));
  }

  // =================== terms & conditions ===================
  const terms: any[] = (q.terms ?? []).filter((tm: any) => tm.label || tm.value);
  const pointLines = (value: string) => String(value ?? "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const SUB = /^[•·\-–]\s*/;   // a line starting with a bullet is a sub-point of the line above
  const points = (value: string, gap = 0, size = 22) => pointLines(value).map((line) => (SUB.test(line)
    ? p(line.replace(SUB, ""), { bullet: "arrow", level: 1, base: { size } })
    : p(line, { bullet: "arrow", after: gap, base: { size } })));
  body.push(heading("TERMS & CONDITIONS: -", { before: 0, pageBreak: true }));
  const IND = 1440;
  body.push(p("Above-mentioned prices are Ex, Chennai. Order to be placed on", { indent: IND }));
  body.push(p({ text: `M/s. ${coName},`, bold: true }, { indent: IND }));
  for (const a of co.addressLines ?? []) body.push(p(a, { indent: IND }));
  if (co.gstin) body.push(p(`GSTIN: - ${co.gstin}`, { indent: IND }));
  if (email) body.push(new Paragraph({ indent: { left: IND }, children: [run("E-Mail: - "), link(email, `mailto:${email}`, { bold: true })] }));
  for (const tm of terms.filter((x) => INLINE_TERMS.test(String(x.label).trim()))) {
    const vals = pointLines(tm.value);
    body.push(p([{ text: /tax/i.test(tm.label) ? `${tm.label}: - ` : `${tm.label}: ` }, { text: vals[0] ?? "", bold: /tax/i.test(tm.label) }], { bullet: "arrow", before: 60 }));
    for (const more of vals.slice(1)) body.push(p(more, { indent: 720 }));
  }
  const regular = terms.filter((x) => !INLINE_TERMS.test(String(x.label).trim()) && !PAGE_TERMS.test(String(x.label).trim()));
  for (const tm of regular) {
    if (tm.label) body.push(heading(`${upper(tm.label)}: -`, { before: 280, after: 40 }));
    body.push(...points(tm.value));
  }
  body.push(p({ text: "All typographical and Clerical errors are subject to correction.", bold: true, size: 24 }, { bullet: "diamond", before: 360 }));
  for (const tm of terms.filter((x) => PAGE_TERMS.test(String(x.label).trim()))) {
    body.push(heading(`${upper(tm.label)}: -`, { before: 0, after: 160, pageBreak: true }));
    body.push(...points(tm.value, 80, 20));   // the warranty is set in 10 pt, as in the template, so it fits its page
  }

  // =================== header and footer (every page after the cover) ===================
  const doubleLine = { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 24, color: LINE_BLUE, space: 1 };
  const header = new Header({ children: [new Paragraph({
    alignment: AlignmentType.CENTER, border: { bottom: doubleLine },
    children: letterhead ? [picture(letterhead, 468, 100)] : [run({ text: coName, bold: true, color: BLUE, size: 32 })],
  })] });
  const ft = { font: TIMES, size: 22 };
  const footer = new Footer({ children: [new Paragraph({
    border: { top: doubleLine }, tabStops: [{ type: TabStopType.RIGHT, position: W }],
    children: [
      run({ text: "Web: ", ...ft }), ...(website ? [link(website, url(website), ft)] : []),
      // the e-mail comes from the Company page; without one the footer shows the website only
      ...(email ? [run({ text: "\t", ...ft }), run({ text: "E-Mail: ", ...ft }), link(email, `mailto:${email}`, ft)] : []),
    ],
  })] });

  const bullet = (reference: string, text: string, font: string, level1?: { text: string; font: string }) => ({
    reference,
    levels: [
      { level: 0, format: LevelFormat.BULLET, text, alignment: AlignmentType.LEFT, style: { run: { font }, paragraph: { indent: { left: 720, hanging: 360 } } } },
      ...(level1 ? [{ level: 1, format: LevelFormat.BULLET, text: level1.text, alignment: AlignmentType.LEFT, style: { run: { font: level1.font }, paragraph: { indent: { left: 1440, hanging: 360 } } } }] : []),
    ],
  });

  const page = { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 2650, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 420, footer: 794 } };
  return new Document({
    creator: coName, title: `Project Quotation ${q.number ?? ""}`,
    styles: { default: { document: { run: { font: ARIAL, size: 22 } } } },
    numbering: { config: [
      bullet("arrow", "", "Wingdings", { text: "", font: "Symbol" }),
      bullet("square", "", "Wingdings"),
      bullet("diamond", "", "Wingdings"),
    ] },
    sections: [
      // the cover has no letterhead or footer
      { properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 1300, bottom: 600, left: 600, right: 600 } } }, children: cover },
      { properties: { page }, headers: { default: header }, footers: { default: footer }, children: body },
    ],
  });
}

export async function renderProjectQuoteDocx(q: any): Promise<Buffer> {
  const [{ logo }, cover, offers, technicals] = await Promise.all([
    loadBranding(),
    loadImage(q.coverImage),
    Promise.all((q.offers ?? []).map(async (o: any) => (await Promise.all((o.images ?? []).map(loadImage))).filter(Boolean) as Img[])),
    Promise.all(technicalsOf(q).map((tch) => loadImage(tch.image ?? null))),
  ]);
  return Packer.toBuffer(buildProjectQuoteDocx(q, { logo, cover, offers, technicals }));
}
