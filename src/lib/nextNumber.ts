/* eslint-disable @typescript-eslint/no-explicit-any */
import { Counter } from "@/models/Counter";

/** atomically allocates the next running quote number (continues across financial years) */
export async function nextQuoteSeq(startNo: number): Promise<number> {
  await Counter.updateOne({ key: "quote" }, { $setOnInsert: { seq: Math.max(1, startNo) - 1 } }, { upsert: true }).catch(() => null);
  const c: any = await Counter.findOneAndUpdate({ key: "quote" }, { $inc: { seq: 1 } }, { new: true });
  return c.seq;
}
