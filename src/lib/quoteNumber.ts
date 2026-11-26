/* eslint-disable @typescript-eslint/no-explicit-any */
/* Quotation numbers can be changed by hand. A number belongs to one quotation only – across equipment, spare and project
   quotations, ignoring upper / lower case. Revisions of an equipment / spare quotation share its number (Rev 1, Rev 2 …),
   so they are one owner. */
import { Quote } from "@/models/Quote";
import { ProjectQuote } from "@/models/ProjectQuote";
import { normNumber } from "./quoteNumberRules";
export { normNumber };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** the quotation being edited, so it does not count as "another" quotation */
export type NumberSelf = { kind: "quote"; category: string; seq: number } | { kind: "project"; id: string } | null;

/** who already uses this number – a short label, or null when it is free */
export async function numberOwner(number: string, self: NumberSelf = null): Promise<string | null> {
  const n = normNumber(number);
  if (!n) return null;
  const re = new RegExp(`^\\s*${esc(n)}\\s*$`, "i");
  const q: any = await Quote.findOne({ number: re, ...(self?.kind === "quote" ? { $nor: [{ category: self.category, seq: self.seq }] } : {}) })
    .select("number category").lean();
  if (q) return `${q.category === "equipment" ? "an equipment" : "a spare"} quotation (${q.number})`;
  const p: any = await ProjectQuote.findOne({ number: re, ...(self?.kind === "project" ? { _id: { $ne: self.id } } : {}) }).select("number").lean();
  if (p) return `a project quotation (${p.number})`;
  return null;
}

export const takenMessage = (number: string, owner: string) => `The number “${normNumber(number)}” is already used by ${owner}. Choose another number.`;

/** the next automatic number that nobody has typed in by hand already (a taken one is skipped) */
export async function nextFreeNumber(allocate: () => Promise<number>, format: (seq: number) => string): Promise<{ seq: number; number: string }> {
  let seq = await allocate(), number = format(seq);
  for (let i = 0; i < 200 && (await numberOwner(number)); i++) { seq = await allocate(); number = format(seq); }
  return { seq, number };
}
