/* eslint-disable @typescript-eslint/no-explicit-any */
/* Server side of the stock ledger: reading balances, checking a change against the "never below zero" rule,
   and keeping StockItem.balance + the low-stock alerts in step after every write. */
import { NextResponse } from "next/server";
import { StockAlert, StockItem, StockMove } from "@/models/Stock";
import { LOW_STOCK, firstNewNegative, dayLabel, qtyText, r2, type LedgerRow, type Move } from "./stockCalc";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** MongoDB returns the first 101 documents and makes the client ask again for the rest; with a batch this large the whole ledger arrives in one round trip */
const BIG = 10000;
const SIGNED = { $cond: [{ $eq: ["$dir", "in"] }, "$qty", { $multiply: ["$qty", -1] }] };

export type LedgerQuery = { from: string; to: string; q?: string | null; location?: string | null; level?: string | null; moved?: boolean; pns?: string[] };

/** ledger rows for a date range: opening at `from`, inward / outward inside the range, closing at `to` */
export async function ledgerRows({ from, to, q, location, level, moved, pns }: LedgerQuery): Promise<LedgerRow[]> {
  const filter: Record<string, any> = {};
  if (pns) filter.pn = { $in: pns };
  const text = q?.trim();
  if (text) { const re = new RegExp(esc(text), "i"); filter.$or = [{ pn: re }, { desc: re }, { location: re }]; }
  if (location === "-") filter.location = { $in: ["", null] }; else if (location) filter.location = location;

  const inRange = (dir: "in" | "out", doc?: boolean) => ({ $sum: { $cond: [{ $and: [{ $gte: ["$date", from] }, { $eq: ["$dir", dir] }, ...(doc ? [{ $eq: ["$src", "doc"] }] : [])] }, "$qty", 0] } });
  // both questions go out together; the totals cover every part unless specific part numbers were asked for
  const [items, sums] = await Promise.all([
    StockItem.find(filter).select("pn desc location opening").batchSize(BIG).lean<any[]>(),
    StockMove.aggregate([
    { $match: { date: { $lte: to }, ...(pns ? { pn: { $in: pns } } : {}) } },
    { $group: { _id: "$pn", before: { $sum: { $cond: [{ $lt: ["$date", from] }, SIGNED, 0] } }, inward: inRange("in"), outward: inRange("out"), docIn: inRange("in", true), docOut: inRange("out", true) } },
    ]).option({ batchSize: BIG }),
  ]);
  if (items.length === 0) return [];
  const byPn = new Map(sums.map((s) => [s._id as string, s]));

  let rows: LedgerRow[] = items.map((i) => {
    const s = byPn.get(i.pn);
    const opening = r2((i.opening ?? 0) + (s?.before ?? 0)), inward = r2(s?.inward ?? 0), outward = r2(s?.outward ?? 0);
    return { id: String(i._id), pn: i.pn, desc: i.desc ?? "", location: i.location ?? "", opening, inward, outward, closing: r2(opening + inward - outward), docIn: r2(s?.docIn ?? 0), docOut: r2(s?.docOut ?? 0) };
  });
  if (moved) rows = rows.filter((r) => r.inward || r.outward);
  if (level === "low") rows = rows.filter((r) => r.closing <= LOW_STOCK);
  else if (level === "out") rows = rows.filter((r) => r.closing <= 0);
  else if (level === "negative") rows = rows.filter((r) => r.closing < 0);
  else if (level === "ok") rows = rows.filter((r) => r.closing > LOW_STOCK);
  // rack order (A-2 before A-10), parts without a location last
  const col = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  return rows.sort((a, b) => (!a.location !== !b.location ? (a.location ? -1 : 1) : col.compare(a.location, b.location) || col.compare(a.pn, b.pn)));
}

type StoredMove = Move & { _id: any; src: "manual" | "doc"; docId?: any };
export type MoveChange = {
  /** which stored movements the change removes */
  remove?: (m: StoredMove) => boolean;
  add?: Move[];
  /** a corrected first stock count: part number → new value */
  opening?: Record<string, number>;
};

/** Throws a 400 response naming the part when the change would take stock below zero (see firstNewNegative). */
export async function assertNoNegative(pns: string[], change: MoveChange) {
  const affected = [...new Set(pns)].filter(Boolean);
  if (affected.length === 0) return;
  const [items, moves] = await Promise.all([
    StockItem.find({ pn: { $in: affected } }).select("pn opening").lean<any[]>(),
    StockMove.find({ pn: { $in: affected } }).select("pn date dir qty src docId").lean<StoredMove[]>(),
  ]);
  const openingOf = new Map(items.map((i) => [i.pn as string, Number(i.opening ?? 0)]));
  for (const pn of affected) {
    const before = moves.filter((m) => m.pn === pn);
    const after = [...before.filter((m) => !change.remove?.(m)), ...(change.add ?? []).filter((m) => m.pn === pn)];
    const was = openingOf.get(pn) ?? 0;
    const hit = firstNewNegative({ before: was, after: change.opening?.[pn] ?? was }, before, after);
    if (!hit) continue;
    throw NextResponse.json({
      error: !openingOf.has(pn) ? `Part ${pn} is not in the stock ledger, so there is nothing to send out. Enter it inward first.`
        : `Not enough stock of ${pn}: the balance${hit.date ? ` on ${dayLabel(hit.date)}` : ""} is ${qtyText(hit.was)} and this would make it ${qtyText(hit.balance)}. Stock cannot go below zero.`,
      pn,
    }, { status: 400 });
  }
}

/** Recomputes the cached current balance of these parts and raises / clears their low-stock alerts.
    An alert is raised only when a change takes a part from above the level down to it – not for parts that were already low. */
export async function refreshBalances(pns: string[], cause = "", opts: { alerts?: boolean } = {}) {
  const affected = [...new Set(pns)].filter(Boolean);
  if (affected.length === 0) return;
  const [items, sums] = await Promise.all([
    StockItem.find({ pn: { $in: affected } }).select("pn desc location opening balance").lean<any[]>(),
    StockMove.aggregate([{ $match: { pn: { $in: affected } } }, { $group: { _id: "$pn", net: { $sum: SIGNED } } }]),
  ]);
  const net = new Map(sums.map((s) => [s._id as string, s.net as number]));
  const ops: any[] = [], raise: any[] = [], clear: string[] = [];
  for (const i of items) {
    const balance = r2((i.opening ?? 0) + (net.get(i.pn) ?? 0)), was = Number(i.balance ?? 0);
    if (balance !== was) ops.push({ updateOne: { filter: { _id: i._id }, update: { $set: { balance } } } });
    if (balance > LOW_STOCK) clear.push(i.pn);
    else if (was > LOW_STOCK && opts.alerts !== false) raise.push({ updateOne: { filter: { pn: i.pn }, update: { $set: { desc: i.desc, location: i.location, balance, cause, at: new Date() } }, upsert: true } });
  }
  // an alert that already exists keeps following the balance (3 → 1 → 0) without counting as a new one
  const follow = opts.alerts === false ? [] : items.map((i) => ({ i, balance: r2((i.opening ?? 0) + (net.get(i.pn) ?? 0)) })).filter((x) => x.balance <= LOW_STOCK && Number(x.i.balance ?? 0) <= LOW_STOCK)
    .map(({ i, balance }) => ({ updateOne: { filter: { pn: i.pn }, update: { $set: { balance, desc: i.desc, location: i.location } } } }));
  await Promise.all([
    ops.length ? StockItem.bulkWrite(ops) : null,
    clear.length ? StockAlert.deleteMany({ pn: { $in: clear } }) : null,
    raise.length ? StockAlert.bulkWrite(raise) : null,
    follow.length ? StockAlert.bulkWrite(follow) : null,
  ]);
}

/** makes sure every part number has a ledger row (opening 0) – used when goods come in for a part that was never stocked */
export async function ensureItems(lines: { pn: string; desc?: string }[], day: string) {
  const want = new Map<string, string>();
  for (const l of lines) if (l.pn && !want.has(l.pn)) want.set(l.pn, l.desc ?? "");
  if (want.size === 0) return [] as string[];
  const have = new Set((await StockItem.find({ pn: { $in: [...want.keys()] } }).select("pn").lean<any[]>()).map((i) => i.pn));
  const missing = [...want.entries()].filter(([pn]) => !have.has(pn));
  if (missing.length) await StockItem.insertMany(missing.map(([pn, desc]) => ({ pn, desc, location: "", opening: 0, openingDate: day, balance: 0 })), { ordered: false }).catch(() => null);
  return missing.map(([pn]) => pn);
}

/** the distinct rack locations, in rack order, for the filter drop-down */
export async function stockLocations(): Promise<string[]> {
  const col = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  return ((await StockItem.distinct("location")) as string[]).filter(Boolean).sort(col.compare);
}
