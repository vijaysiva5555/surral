/* eslint-disable @typescript-eslint/no-explicit-any */
import { PartPrice } from "@/models/PartPrice";

export const keyOf = (pn: string, pga: string) => `${pn}|${pga}`;

/** key -> price for one price list */
export async function priceMap(listId: unknown): Promise<Map<string, number>> {
  const rows = await PartPrice.find({ priceListId: listId }).select("pn pga listPrice").lean<any[]>();
  return new Map(rows.map((r) => [keyOf(r.pn, r.pga), r.listPrice]));
}

export function compareMaps(a: Map<string, number>, b: Map<string, number>) {
  const added: string[] = [], removed: string[] = [], changed: { key: string; a: number; b: number; pct: number | null }[] = [];
  let unchanged = 0;
  for (const [k, pb] of b) {
    const pa = a.get(k);
    if (pa === undefined) added.push(k);
    else if (pa === pb) unchanged++;
    else changed.push({ key: k, a: pa, b: pb, pct: pa > 0 ? ((pb - pa) / pa) * 100 : null });
  }
  for (const k of a.keys()) if (!b.has(k)) removed.push(k);
  const pcts = changed.map((c) => c.pct).filter((x): x is number => x !== null && Math.abs(x) < 1000).sort((x, y) => x - y);
  return {
    added, removed, changed, unchanged,
    avgPct: pcts.length ? pcts.reduce((s, x) => s + x, 0) / pcts.length : 0,
    medianPct: pcts.length ? pcts[Math.floor(pcts.length / 2)] : 0,
  };
}
