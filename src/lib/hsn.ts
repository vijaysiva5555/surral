/* eslint-disable @typescript-eslint/no-explicit-any */
import { PartHsn } from "@/models/PartHsn";
/** remember the HSN typed against each Graco part so the next quotation fills it in */
export async function learnHsn(lines: any[]) {
  const ops = lines.filter((l) => l.kind === "part" && l.code && String(l.hsn ?? "").trim())
    .map((l) => ({ updateOne: { filter: { pn: String(l.code).toUpperCase() }, update: { $set: { hsn: String(l.hsn).trim() } }, upsert: true } }));
  if (ops.length) await PartHsn.bulkWrite(ops, { ordered: false }).catch(() => null);
}
