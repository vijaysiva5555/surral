/* eslint-disable @typescript-eslint/no-explicit-any */
import { Counter } from "@/models/Counter";
import type { QuoteCategory } from "@/lib/quoteCategory";

/** atomically allocates the next running project-offer number (its own series) */
export async function nextProjectSeq(startNo: number): Promise<number> {
  await Counter.updateOne({ key: "projectQuote" }, { $setOnInsert: { seq: Math.max(1, startNo) - 1 } }, { upsert: true }).catch(() => null);
  const c: any = await Counter.findOneAndUpdate({ key: "projectQuote" }, { $inc: { seq: 1 } }, { new: true });
  return c.seq;
}

/** atomically allocates the next running quote number (continues across financial years; separate series per category) */
export async function nextQuoteSeq(startNo: number, category: QuoteCategory = "spare"): Promise<number> {
  const key = category === "spare" ? "quote" : "equipmentQuote";
  await Counter.updateOne({ key }, { $setOnInsert: { seq: Math.max(1, startNo) - 1 } }, { upsert: true }).catch(() => null);
  const c: any = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true });
  return c.seq;
}
