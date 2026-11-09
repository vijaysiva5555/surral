/* Shared by the editor (live preview), the API (authoritative totals), the PDF and the Excel export. */

import type { BomSnapshot } from "./bomCalc";

export type QuoteLine = {
  id: string; kind: "part" | "package" | "custom";
  code: string; description: string; hsn: string; qty: number; uom: string;
  basicPrice: number; discountPct: number; subItems: string[];
  costPrice?: number;   // internal landed cost per unit (never printed)
  priceRef?: { pn: string; pga: string; year: number; listPrice: number };
  bom?: BomSnapshot;    // the BOM package this line was built from (internal, never printed)
  agreement?: string;   // label of the customer price agreement applied (internal)
};
export type Term = { label: string; value: string };
export type Totals = { subtotal: number; supply: "intra" | "inter"; gstRate: number; cgst: number; sgst: number; igst: number; roundOff: number; total: number; words: string };

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ceilSafe = (n: number) => Math.ceil(n - 1e-9); // Excel-like ROUNDUP that ignores float dust (4200.0000000001 -> 4200)

export const lineUnit = (l: Pick<QuoteLine, "basicPrice" | "discountPct">) => r2(l.basicPrice * (1 - l.discountPct / 100));
export const lineTotal = (l: QuoteLine) => r2(lineUnit(l) * l.qty);

// ---- GST / totals ----
export const supplyType = (companyState?: string, customerState?: string): "intra" | "inter" =>
  companyState && customerState && companyState !== customerState ? "inter" : "intra";

export function computeTotals(lines: QuoteLine[], gstRate: number, supply: "intra" | "inter"): Totals {
  const subtotal = r2(lines.reduce((s, l) => s + lineTotal(l), 0));
  const cgst = supply === "intra" ? r2((subtotal * gstRate) / 200) : 0;
  const sgst = cgst;
  const igst = supply === "inter" ? r2((subtotal * gstRate) / 100) : 0;
  const raw = subtotal + cgst + sgst + igst;
  const total = Math.round(raw);
  return { subtotal, supply, gstRate, cgst, sgst, igst, roundOff: r2(total - raw), total, words: amountInWords(total) };
}

// ---- Indian number to words ("Two Lakhs Fifty Nine Thousand Ten") ----
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const below100 = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
const below1000 = (n: number) => (n >= 100 ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + below100(n % 100) : "") : below100(n));
export function amountInWords(amount: number): string {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(below1000(crore) + (crore > 1 ? " Crores" : " Crore"));
  if (lakh) parts.push(below100(lakh) + (lakh > 1 ? " Lakhs" : " Lakh"));
  if (thousand) parts.push(below100(thousand) + " Thousand");
  if (n) parts.push(below1000(n));
  return "Rupees " + parts.join(" ") + " Only";
}

// ---- numbering / dates ----
export function financialYear(d: Date): string {
  const y = d.getUTCFullYear(), start = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}
export const displayNumber = (q: { number: string; revision?: number }) => (q.revision ? `${q.number} Rev ${q.revision}` : q.number);

export const DEFAULT_TERMS = (customerShort: string): Term[] => [
  { label: "Price", value: `Your Works (${customerShort})` },
  { label: "Payment Terms", value: "45 Days" },
  { label: "Delivery", value: "4-6 weeks from the date of your PO" },
  { label: "Taxes", value: "G.S.T Extra as applicable, as above mentioned" },
  { label: "Warranty", value: "12 Months as per Graco's standard warranty only for manufacturing defects" },
  { label: "Freight", value: "Free on Road" },
  { label: "P & F", value: "NIL ( Inclusive )" },
  { label: "HSN Code", value: "Subject to change, we may need amendment" },
  { label: "", value: "All typographical and Clerical errors are subject to correction." },
];

export const blankLine = (kind: QuoteLine["kind"] = "custom"): QuoteLine => ({
  id: Math.random().toString(36).slice(2, 9), kind, code: "", description: "", hsn: "", qty: 1, uom: kind === "package" ? "Set" : "Nos", basicPrice: 0, discountPct: 0, subItems: [],
});
