/** Legacy package costing sheet (two margins + round-up). Used by CostingModal only – BOM packages use bomCalc instead. */

import { r2 } from "./quoteCalc";

const ceilSafe = (n: number) => Math.ceil(n - 1e-9);

export type CostItem = {
  make: string;
  description: string;
  qty: number;
  listPrice: number;
  discountPct: number;
  manualCost: number;
};

export type Costing = {
  items: CostItem[];
  margin1Pct: number;
  margin2Pct: number;
  roundTo: number;
};

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const rowLetter = (n: number) => (n < 26 ? LETTERS[n] : LETTERS[Math.floor(n / 26) - 1] + LETTERS[n % 26]);

const isBlank = (i: CostItem) => !i.make.trim() && !i.description.trim() && !i.listPrice && !i.manualCost;

export const newCosting = (): Costing => ({ items: [], margin1Pct: 20, margin2Pct: 10, roundTo: 100 });

export const costLanded = (it: CostItem) =>
  it.listPrice > 0 ? r2(it.listPrice * (1 - it.discountPct / 100)) : r2(it.manualCost);

export const costUnit = (it: CostItem, c: Costing) => ceilSafe(costLanded(it) * (1 + c.margin1Pct / 100));

export const costSell = (it: CostItem, c: Costing) => r2(costUnit(it, c) * (1 + c.margin2Pct / 100));

function roundUpTo(n: number, step: number) {
  const s = step > 0 ? step : 1;
  return Math.ceil(n / s) * s;
}

export function costingSummary(c: Costing) {
  const items = c.items.filter((i) => !isBlank(i));
  const landed = r2(items.reduce((s, it) => s + costLanded(it) * it.qty, 0));
  const afterM1 = r2(items.reduce((s, it) => s + costUnit(it, c) * it.qty, 0));
  const sell = r2(items.reduce((s, it) => s + costSell(it, c) * it.qty, 0));
  const suggested = roundUpTo(sell, c.roundTo);
  const marginPct = suggested > 0 ? ((suggested - landed) / suggested) * 100 : 0;
  return { landed, afterM1, sell, suggested, marginPct };
}

/** “Consists of” lines for a package quotation line */
export const consistsOf = (c: Costing) =>
  c.items
    .filter((i) => !isBlank(i))
    .map((i, n) => `${rowLetter(n)}.${i.description || i.make} - ${i.qty} ${i.qty === 1 ? "No" : "Nos"}`);
