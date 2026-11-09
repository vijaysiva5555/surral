/* BOM = bill of materials for one sellable package. Same columns as the Excel BOM sheet:
   S.NO · MAKE · DESCRIPTION · QTY · List Price · Total List Price · Dis % · Landed Price · Total Landed · Margin % · Unit Price */

export type BomItem = {
  make: string; description: string; qty: number;
  listPrice: number;     // Graco list price per unit (0 = bought-out item without a list price)
  discountPct: number;   // distributor discount on list price
  landed: number;        // landed cost per unit – only used when listPrice is 0 (typed in manually)
  marginPct: number;     // margin on landed cost, e.g. 20
};
export type Bom = { items: BomItem[] };
export type BomSnapshot = Bom & { bomId?: string; name: string; date?: string };

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ceilSafe = (n: number) => Math.ceil(n - 1e-9);   // Excel-style ROUNDUP that ignores float dust (4200.0000000001 -> 4200)
export const blankItem = (): BomItem => ({ make: "", description: "", qty: 1, listPrice: 0, discountPct: 0, landed: 0, marginPct: 20 });
export const isBlankItem = (i: BomItem) => !i.make.trim() && !i.description.trim() && !i.listPrice && !i.landed;

export const itemTotalList = (i: BomItem) => r2(i.listPrice * i.qty);
export const itemLanded = (i: BomItem) => (i.listPrice > 0 ? r2(i.listPrice * (1 - i.discountPct / 100)) : i.landed);
export const itemTotalLanded = (i: BomItem) => r2(itemLanded(i) * i.qty);
export const itemUnitPrice = (i: BomItem) => ceilSafe(itemLanded(i) * (1 + i.marginPct / 100));   // ROUNDUP(landed × (1 + margin), 0)
export const itemTotalUnit = (i: BomItem) => itemUnitPrice(i) * i.qty;

/** The price of a BOM is the total of its Unit Price column (Σ unit price × qty) */
export function bomSummary(b: Bom) {
  const items = b.items.filter((i) => !isBlankItem(i));
  const list = r2(items.reduce((s, i) => s + itemTotalList(i), 0));
  const landed = r2(items.reduce((s, i) => s + itemTotalLanded(i), 0));
  const unit = r2(items.reduce((s, i) => s + itemTotalUnit(i), 0));
  return { list, landed, unit, price: unit, marginPct: unit > 0 ? ((unit - landed) / unit) * 100 : 0, count: items.length };
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
export const rowLetter = (n: number) => (n < 26 ? LETTERS[n] : LETTERS[Math.floor(n / 26) - 1] + LETTERS[n % 26]);
/** the "Consists of" lines printed on the quotation */
export const consistsOf = (b: Bom) => b.items.filter((i) => !isBlankItem(i)).map((i, n) => `${rowLetter(n)}.${i.description || i.make} - ${i.qty} ${i.qty === 1 ? "No" : "Nos"}`);
