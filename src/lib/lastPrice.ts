/* Shared by the quotation editor and /api/search/last-prices: how a quotation line is recognised as "the same item"
   as one quoted before. Graco parts by their code; packages and custom items by their description. */

export type LastPrice = {
  unitPrice: number; basicPrice: number; discountPct: number; qty: number; uom: string;
  date: string; quoteId: string; number: string; revision?: number; category: "spare" | "equipment"; status: string;
  times: number; minPrice: number; maxPrice: number;
};

export function lineKey(l: { kind?: string; code?: string; description?: string }): string {
  const code = (l.code ?? "").trim();
  if (l.kind === "part" && code) return `p:${code.toUpperCase()}`;
  const d = (l.description ?? "").trim().toLowerCase();
  return d ? `d:${d}` : "";
}
