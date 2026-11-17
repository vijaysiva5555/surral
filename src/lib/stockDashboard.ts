/* eslint-disable @typescript-eslint/no-explicit-any */
/* Numbers for the stock dashboard: stock levels, movement today / this month / this financial year, recent documents. */
import { StockAlert, StockDoc, StockItem, StockMove } from "@/models/Stock";
import { LOW_STOCK, fyOf, periodRange, r2, todayIST } from "./stockCalc";

export type MoveTally = { inQty: number; outQty: number; inDocs: number; outDocs: number };
export type StockDash = {
  today: string;
  levels: { parts: number; ok: number; low: number; out: number; negative: number };
  moves: { today: MoveTally; month: MoveTally; year: MoveTally };
  recentOut: any[]; recentIn: any[]; alerts: any[]; lowest: any[];
};

export async function stockDashboard(): Promise<StockDash> {
  const today = todayIST(), month = periodRange("month", today).from, year = fyOf(today).from;
  const since = (d: string, dir: "in" | "out") => ({ $sum: { $cond: [{ $and: [{ $gte: ["$date", d] }, { $eq: ["$dir", dir] }] }, "$qty", 0] } });
  const docsSince = (d: string, type: "in" | "out") => ({ $sum: { $cond: [{ $and: [{ $gte: ["$date", d] }, { $eq: ["$type", type] }] }, 1, 0] } });
  const [levels, [mv], [dc], recentOut, recentIn, alerts, lowest] = await Promise.all([
    StockItem.aggregate([{ $group: { _id: null, parts: { $sum: 1 },
      ok: { $sum: { $cond: [{ $gt: ["$balance", LOW_STOCK] }, 1, 0] } },
      low: { $sum: { $cond: [{ $and: [{ $gt: ["$balance", 0] }, { $lte: ["$balance", LOW_STOCK] }] }, 1, 0] } },
      out: { $sum: { $cond: [{ $eq: ["$balance", 0] }, 1, 0] } },
      negative: { $sum: { $cond: [{ $lt: ["$balance", 0] }, 1, 0] } } } }]),
    StockMove.aggregate([{ $match: { date: { $gte: year, $lte: today } } }, { $group: { _id: null, tIn: since(today, "in"), tOut: since(today, "out"), mIn: since(month, "in"), mOut: since(month, "out"), yIn: since(year, "in"), yOut: since(year, "out") } }]),
    StockDoc.aggregate([{ $match: { date: { $gte: year, $lte: today } } }, { $group: { _id: null, tIn: docsSince(today, "in"), tOut: docsSince(today, "out"), mIn: docsSince(month, "in"), mOut: docsSince(month, "out"), yIn: docsSince(year, "in"), yOut: docsSince(year, "out") } }]),
    StockDoc.find({ type: "out" }).sort({ date: -1, createdAt: -1 }).limit(6).select("no date party qtyTotal lines.pn").lean<any[]>(),
    StockDoc.find({ type: "in" }).sort({ date: -1, createdAt: -1 }).limit(6).select("no date party qtyTotal lines.pn").lean<any[]>(),
    StockAlert.find().sort({ at: -1 }).limit(8).lean<any[]>(),
    // the fast movers that are about to run out: low or empty parts that went out most recently
    StockMove.aggregate([{ $match: { dir: "out" } }, { $group: { _id: "$pn", last: { $max: "$date" } } }, { $sort: { last: -1 } }, { $limit: 400 },
      { $lookup: { from: StockItem.collection.name, localField: "_id", foreignField: "pn", as: "item" } }, { $unwind: "$item" }, { $match: { "item.balance": { $lte: LOW_STOCK } } }, { $limit: 8 },
      { $project: { pn: "$_id", last: 1, desc: "$item.desc", location: "$item.location", balance: "$item.balance" } }]),
  ]);
  const t = (k: "t" | "m" | "y"): MoveTally => ({ inQty: r2(mv?.[`${k}In`] ?? 0), outQty: r2(mv?.[`${k}Out`] ?? 0), inDocs: dc?.[`${k}In`] ?? 0, outDocs: dc?.[`${k}Out`] ?? 0 });
  const l = levels[0] ?? { parts: 0, ok: 0, low: 0, out: 0, negative: 0 };
  return { today, levels: { parts: l.parts, ok: l.ok, low: l.low, out: l.out, negative: l.negative }, moves: { today: t("t"), month: t("m"), year: t("y") }, recentOut, recentIn, alerts, lowest };
}
