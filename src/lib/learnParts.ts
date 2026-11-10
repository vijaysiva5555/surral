/* eslint-disable @typescript-eslint/no-explicit-any */
import { Part } from "@/models/Part";

/**
 * A part number typed into a quotation's CODE column may not exist in the parts master yet
 * (for example a part Graco's price list does not carry). Add it, so the next quotation can
 * find it through the normal part search. Existing parts are never overwritten.
 */
export async function learnParts(lines: any[]) {
  const rows = new Map<string, { pn: string; pga: string; desc: string }>();
  for (const l of lines ?? []) {
    if (l.kind !== "part") continue;                       // package lines carry a brand, custom lines are free text
    const pn = String(l.code ?? "").trim().toUpperCase();
    if (!pn) continue;
    const pga = String(l.priceRef?.pga ?? "").trim();
    const key = `${pn}|${pga}`;
    if (!rows.has(key)) rows.set(key, { pn, pga, desc: String(l.description ?? "").trim() });
  }
  if (!rows.size) return;
  await Part.bulkWrite(
    [...rows.values()].map((r) => ({
      updateOne: { filter: { pn: r.pn, pga: r.pga }, update: { $setOnInsert: r }, upsert: true },
    })),
    { ordered: false }
  ).catch(() => null);   // a concurrent insert hitting the unique index must not fail the save
}
