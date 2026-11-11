export type QuoteCategory = "spare" | "equipment";

export function parseQuoteCategory(v: string | null | undefined): QuoteCategory {
  return v === "equipment" ? "equipment" : "spare";
}

export function quotePrefixFor(company: { quotePrefix?: string; equipmentQuotePrefix?: string } | null | undefined, category: QuoteCategory): string {
  if (category === "equipment") {
    const p = String(company?.equipmentQuotePrefix ?? "").trim();
    if (p) return p;
    const sq = String(company?.quotePrefix ?? "SSCPL/SQ").trim();
    return sq.replace(/\/SQ$/i, "/EQ") || "SSCPL/EQ";
  }
  return String(company?.quotePrefix ?? "SSCPL/SQ").trim() || "SSCPL/SQ";
}

export function quoteStartNo(company: { quoteStartNo?: number; equipmentQuoteStartNo?: number } | null | undefined, category: QuoteCategory): number {
  if (category === "equipment") return company?.equipmentQuoteStartNo ?? company?.quoteStartNo ?? 1;
  return company?.quoteStartNo ?? 1;
}

/** Spare numbers match workbook layout, e.g. SSCPL/SQ/0001/26-27 */
export function formatQuoteNumber(prefix: string, seq: number, fy: string, category: QuoteCategory): string {
  const seg = category === "spare" ? String(seq).padStart(4, "0") : String(seq);
  return `${prefix}/${seg}/${fy}`;
}

export function previewQuoteNumber(
  company: { quotePrefix?: string; equipmentQuotePrefix?: string } | null | undefined,
  fy: string,
  category: QuoteCategory,
): string {
  const prefix = quotePrefixFor(company, category);
  if (category === "spare") return `${prefix}/0001/${fy}`;
  return `${prefix}/<no.>/${fy}`;
}
