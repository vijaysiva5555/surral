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
};

/** the preview is drawn at A4 = 794 px wide; the PDF page is 595 pt, so PDF sizes are preview px × 0.75 */
export const PREVIEW_WIDTH = 794;
export const PX = 0.75;

/** item table columns in preview px; 0 = takes the remaining width (description) */
export const QUOTE_COLS = [30, 68, 0, 58, 30, 74, 40, 74, 86];
export const QUOTE_HEADS = ["S.No", "Code", "Description of Goods", "HSN", "Qty", "Basic Price", "Disc.", "Unit Price", "Amount"];

export const pctLabel = (n: number) => `${n % 1 ? n.toFixed(1) : n}%`;

export function validUntilLabel(q: any) {
  if (q.validUntil) return dmy(q.validUntil);
  const d = new Date(`${String(q.date ?? "").slice(0, 10)}T12:00:00`);
  if (Number.isNaN(+d)) return `${q.validityDays ?? 0} days`;
  d.setDate(d.getDate() + Number(q.validityDays ?? 0));
  return dmy(d);
}

/** the boxed meta table beside the QUOTATION title */
export function quoteMeta(q: any): [string, string][] {
  const listYear = (q.lines ?? []).reduce((y: number, l: any) => Math.max(y, Number(l.priceRef?.year ?? 0)), 0);
  return [
    ["Quotation No.", displayNumber(q)],
    ["Date", dmy(q.date)],
    ["Valid Until", validUntilLabel(q)],
    ["Reference", q.referredBy || "—"],
    ["Price List", listYear ? String(listYear) : "—"],
  ];
}

/** the "Quotation Details" block beside the customer */
export function quoteDetails(q: any): [string, string][] {
  const cu = q.customer ?? {}, t = q.totals ?? {};
  return [
    ["Place of Supply", cu.state ? `${cu.state}${cu.stateCode ? ` (${cu.stateCode})` : ""}` : "—"],
    ["Tax", t.supply === "inter" ? `IGST ${pctLabel(t.gstRate)}` : `CGST + SGST ${pctLabel(t.gstRate ?? 0)}`],
    ["Prepared By", q.preparedBy?.name ? `${q.preparedBy.name}${q.preparedBy.phone ? ` · ${q.preparedBy.phone}` : ""}` : "—"],
  ];
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

/** the product photo sits beside the first "Consists of" block */
export const firstPackageIndex = (q: any) => (q.lines ?? []).findIndex((l: any) => l.subItems?.length > 0);

export const footerContact = (q: any) => [q.preparedBy?.name, q.preparedBy?.phone, q.company?.email].filter(Boolean).join("  ·  ");
