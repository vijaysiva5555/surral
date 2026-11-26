/* BOM = bill of materials for one sellable package. Same columns as the Excel BOM sheet:
   S.NO · MAKE · DESCRIPTION · QTY · List Price · Total List Price · Dis % · Landed Price · Total Landed · Margin % · Unit Price · Total Price
   · Margin 2 % · Unit Price · Total Price (the optional second margin is added on top of the first unit price) */

export type BomItem = {
  make: string; description: string; qty: number;
  listPrice: number;     // Graco list price per unit (0 = bought-out item without a list price)
  discountPct: number;   // distributor discount on list price
  landed: number;        // landed cost per unit – only used when listPrice is 0 (typed in manually)
  marginPct: number;     // margin on landed cost, e.g. 20
  margin2Pct?: number;   // optional second margin on top of the unit price, e.g. 15 (0 / missing = none)
  section?: string;      // the sheet (section) of the BOM the item is on – missing = the first section
  notes?: string;        // free text after the last Total Price (internal, not printed on quotations)
};
export type Bom = { items: BomItem[]; sections?: string[] };

/** a BOM is one or more sections (sheets), each with a name and its own items – e.g. "Graco Supply", "Surral Supply", "Spares".
    Older BOMs have no sections: all their items are on the first, unnamed one. */
export type BomSection = { name: string; items: BomItem[] };
export function bomSections(b: Bom): BomSection[] {
  const names = [...(b.sections ?? [])];
  const first = names[0] ?? "";
  for (const i of b.items ?? []) { const n = i.section ?? first; if (!names.includes(n)) names.push(n); }
  if (!names.length) names.push("");
  return names.map((name) => ({ name, items: (b.items ?? []).filter((i) => (i.section ?? first) === name) }));
}
/** true when the BOM has more than one section or a named one (then the sections are shown as headings) */
export const hasSections = (b: Bom) => { const s = bomSections(b); return s.length > 1 || !!s[0]?.name; };
export type BomSnapshot = Bom & { bomId?: string; name: string; date?: string };

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ceilSafe = (n: number) => Math.ceil(n - 1e-9);   // Excel-style ROUNDUP that ignores float dust (4200.0000000001 -> 4200)
export const blankItem = (): BomItem => ({ make: "", description: "", qty: 1, listPrice: 0, discountPct: 0, landed: 0, marginPct: 20 });
export const isBlankItem = (i: BomItem) => !i.make.trim() && !i.description.trim() && !i.listPrice && !i.landed;

export const itemTotalList = (i: BomItem) => r2(i.listPrice * i.qty);
export const itemLanded = (i: BomItem) => (i.listPrice > 0 ? r2(i.listPrice * (1 - i.discountPct / 100)) : i.landed);
export const itemTotalLanded = (i: BomItem) => r2(itemLanded(i) * i.qty);
export const itemUnitPrice = (i: BomItem) => ceilSafe(itemLanded(i) * (1 + i.marginPct / 100));   // ROUNDUP(landed × (1 + margin), 0)
export const itemTotalUnit = (i: BomItem) => r2(itemUnitPrice(i) * i.qty);
/** unit price after the second margin – not rounded up, as on the Excel sheet (78 + 15 % = 89.70); equals the unit price when a row has no second margin */
export const itemUnitPrice2 = (i: BomItem) => r2(itemUnitPrice(i) * (1 + (i.margin2Pct || 0) / 100));
export const itemTotalUnit2 = (i: BomItem) => r2(itemUnitPrice2(i) * i.qty);

/** The price of a BOM is the total of its last Total Price column: Σ unit price × qty, after the second margin where a row has one */
export function bomSummary(b: Bom) {
  const items = b.items.filter((i) => !isBlankItem(i));
  const list = r2(items.reduce((s, i) => s + itemTotalList(i), 0));
  const landed = r2(items.reduce((s, i) => s + itemTotalLanded(i), 0));
  const unit = r2(items.reduce((s, i) => s + itemTotalUnit(i), 0));
  const price = r2(items.reduce((s, i) => s + itemTotalUnit2(i), 0));
  return { list, landed, unit, price, marginPct: price > 0 ? ((price - landed) / price) * 100 : 0, count: items.length, hasMargin2: items.some((i) => !!i.margin2Pct) };
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
export const rowLetter = (n: number) => (n < 26 ? LETTERS[n] : LETTERS[Math.floor(n / 26) - 1] + LETTERS[n % 26]);
/** the "Consists of" lines printed on the quotation */
/** the "Consists of" lines printed on the quotation; a BOM with sections gets a "# Section name" heading line before each section's items
    (the letters run on across the sections) */
export function consistsOf(b: Bom): string[] {
  const line = (i: BomItem, n: number) => `${rowLetter(n)}.${i.description || i.make} - ${i.qty} ${i.qty === 1 ? "No" : "Nos"}`;
  if (!hasSections(b)) return b.items.filter((i) => !isBlankItem(i)).map(line);
  let n = 0;
  return bomSections(b).flatMap((s) => { const its = s.items.filter((i) => !isBlankItem(i)); return its.length ? [`# ${s.name || "Items"}`, ...its.map((i) => line(i, n++))] : []; });
}
