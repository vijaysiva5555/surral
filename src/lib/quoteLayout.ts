/* eslint-disable @typescript-eslint/no-explicit-any */
/* Shared by the live preview (components/QuotePreview.tsx) and the PDF (components/pdf/QuotePdf.tsx) so both
   print the same colours, labels and values. Change the layout in one and mirror it in the other. */
import { displayNumber } from "./quoteCalc";
import { dmy } from "./format";

export const QUOTE_COLORS = {
  BRAND: "#0AA5E8",   // Surral blue
  NAVY: "#0B2C4D",    // headings, table head, totals band
  INK: "#0F172A",
  MUTED: "#5B6B7C",
  FAINT: "#9AA5B1",
  LINE: "#DCE4EC",
  ZEBRA: "#F7FAFC",
  SOFT: "#F4F8FB",
  HEAD_LINE: "#324E69",   // dividers inside the navy table head (a solid colour: the PDF renderer mis-draws translucent borders)
};

/** the preview sheet is at least one A4 page tall, so the footer sits at the bottom like in the PDF */
export const PREVIEW_MIN_HEIGHT = 1123;

/** the preview is drawn at A4 = 794 px wide; the PDF page is 595 pt, so PDF sizes are preview px × 0.75 */
export const PREVIEW_WIDTH = 794;
export const PX = 0.75;

/** item table columns in preview px; 0 = takes the remaining width (description) */
export const QUOTE_COLS = [30, 68, 0, 58, 30, 74, 40, 74, 86];
export const QUOTE_HEADS = ["S.No", "Code", "Description of Goods", "HSN", "Qty", "Basic Price", "Disc.", "Unit Price", "Amount"];

/** the index of the "Disc." column in QUOTE_HEADS / QUOTE_COLS */
export const DISC_COL = 6;
/** true when some item line has a discount – otherwise the Disc. column is left out of the quotation */
export const hasDiscount = (lines: any[] | undefined) => (lines ?? []).some((l) => l?.kind !== "heading" && Number(l?.discountPct) > 0);
/** the columns printed: all of them, or all but Disc. (the description column takes the freed width) */
export const quoteColumnIdx = (showDisc: boolean) => QUOTE_HEADS.map((_, i) => i).filter((i) => showDisc || i !== DISC_COL);
export const pctLabel = (n: number) => `${n % 1 ? n.toFixed(1) : n}%`;

export function validUntilLabel(q: any) {
  if (q.validUntil) return dmy(q.validUntil);
  const d = new Date(`${String(q.date ?? "").slice(0, 10)}T12:00:00`);
  if (Number.isNaN(+d)) return `${q.validityDays ?? 0} days`;
  d.setDate(d.getDate() + Number(q.validityDays ?? 0));
  return dmy(d);
}

/** the one boxed table beside the QUOTATION title and the customer: number and dates, then supply, tax and who follows it up.
    Optional rows (reference, price list, followed by) are left out when they have nothing to say. Who prepared the quotation
    is kept with it in the app but not printed. */
export function quoteMeta(q: any): [string, string][] {
  const cu = q.customer ?? {}, t = q.totals ?? {};
  const listYear = (q.lines ?? []).reduce((y: number, l: any) => Math.max(y, Number(l.priceRef?.year ?? 0)), 0);
  const rows: [string, string][] = [
    ["Quotation No.", displayNumber(q)],
    ["Date", dmy(q.date)],
    ["Valid Until", validUntilLabel(q)],
  ];
  if (String(q.referredBy ?? "").trim()) rows.push(["Reference", String(q.referredBy).trim()]);
  if (listYear) rows.push(["Price List", String(listYear)]);
  rows.push(["Place of Supply", cu.state ? `${cu.state}${cu.stateCode ? ` (${cu.stateCode})` : ""}` : "—"]);
  rows.push(["Tax", t.supply === "inter" ? `IGST ${pctLabel(t.gstRate)}` : `CGST + SGST ${pctLabel(t.gstRate ?? 0)}`]);
  const fName = String(q.followedBy ?? "").trim(), fPhone = String(q.followedByPhone ?? "").trim();
  if (fName || fPhone) rows.push(["Followed By", [fName, fPhone].filter(Boolean).join(" · ")]);
  return rows;
}

/** the letterhead contact block: the address on one line, then phone / web / GSTIN on the next */
export function companyContact(co: any): { address: string; items: { text: string; bold?: boolean }[] } {
  const address = (co?.addressLines ?? []).map((l: string) => String(l).trim().replace(/,+$/, "")).filter(Boolean).join(", ");
  const items: { text: string; bold?: boolean }[] = [];
  if (co?.phone) items.push({ text: `Ph ${co.phone}` });
  if (co?.mobile) items.push({ text: `Mob ${co.mobile}` });
  if (co?.email) items.push({ text: co.email });
  if (co?.website) items.push({ text: co.website });
  if (co?.gstin) items.push({ text: `GSTIN ${co.gstin}`, bold: true });
  if (co?.stateCode) items.push({ text: `State Code ${co.stateCode}` });
  return { address, items };
}

/** customer address lines; the pincode gets its own line only when the address does not already end with it */
export function customerAddress(cu: any): string[] {
  const lines: string[] = (cu?.addressLines ?? []).map((l: string) => String(l).trim()).filter(Boolean);
  const pin = String(cu?.pincode ?? "").trim();
  return pin && !lines.some((l) => l.replace(/\s+/g, "").includes(pin)) ? [...lines, pin] : lines;   // "631 604" counts as 631604
}

/** a "Consists of" entry as [marker, text]: BOM lines already start with "a.", "b." … so that letter is the marker, otherwise a bullet */
/** a "Consists of" line starting with "#" is a heading (a BOM section such as "Graco Supply"); returns its text, or null */
export const consistsHeading = (x: string): string | null => { const m = /^\s*#+\s*(.+)$/.exec(x ?? ""); return m ? m[1].trim() : null; };
export function subItemParts(x: string): [string, string] {
  const m = /^\s*([a-z]{1,2})[.)]\s*(.+)$/i.exec(x ?? "");
  return m ? [`${m[1].toLowerCase()}.`, m[2]] : ["•", String(x ?? "").trim()];
}

/** rows of the totals box above the TOTAL band: [label, amount, bold] */
export function quoteTotalRows(q: any): [string, number, boolean][] {
  const t = q.totals ?? {};
  return [
    ["Subtotal", t.subtotal, true],
    ...(t.supply === "inter"
      ? ([[`IGST ${pctLabel(t.gstRate)}`, t.igst, false]] as [string, number, boolean][])
      : ([[`CGST ${pctLabel((t.gstRate ?? 0) / 2)}`, t.cgst, false], [`SGST ${pctLabel((t.gstRate ?? 0) / 2)}`, t.sgst, false]] as [string, number, boolean][])),
    ["Round Off", t.roundOff, false],
  ];
}

export const hasBank = (co: any) => !!(co?.bank?.name || co?.bank?.branch || co?.bank?.accountNo || co?.bank?.ifsc);

/** a line's "Consists of" list – printed only for a line made from a BOM package; any other line shows none */
export const consistsList = (l: any): string[] => (l?.bom ? (l.subItems ?? []).filter((x: string) => String(x ?? "").trim()) : []);

/** the product photo sits beside the first "Consists of" block */
export const firstPackageIndex = (q: any) => (q.lines ?? []).findIndex((l: any) => consistsList(l).length > 0);

/** who the customer should call about this quotation: the followed person, when one is entered (the preparer is not printed) */
export function quoteContact(q: any): string {
  const name = String(q.followedBy ?? "").trim(), phone = String(q.followedByPhone ?? "").trim();
  return [name, phone].filter(Boolean).join(", ");
}

/** footer line: the followed person to contact, then the company's e-mail and website */
export function footerContact(q: any) {
  const co = q.company ?? {}, who = quoteContact(q);
  return [who ? `Contact: ${who}` : "", co.email, co.website].filter(Boolean).join("  ·  ") || co.name || "";
}
