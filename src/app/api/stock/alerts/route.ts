/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { LOW_STOCK } from "@/lib/stockCalc";
import { StockAlert } from "@/models/Stock";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** The low-stock bell (admin and stock users): parts that dropped to the low level, newest first, and how many are new since the user last looked. */
export const GET = () => handle(async () => {
  const session = await guardAccess("stockLedger");
  await dbConnect();
  const me = await User.findById(session.user.id).select("stockAlertsSeenAt").lean<any>();
  const seenAt: Date = me?.stockAlertsSeenAt ?? new Date(0);
  const [items, total, unseen] = await Promise.all([
    StockAlert.find().sort({ at: -1 }).limit(30).lean<any[]>(),
    StockAlert.countDocuments(),
    StockAlert.countDocuments({ at: { $gt: seenAt } }),
  ]);
  return NextResponse.json({ level: LOW_STOCK, total, unseen, items: items.map((a) => ({ pn: a.pn, desc: a.desc ?? "", location: a.location ?? "", balance: a.balance ?? 0, cause: a.cause ?? "", at: a.at, isNew: a.at > seenAt })) });
});

/** the user opened the bell: everything up to now counts as seen */
export const POST = () => handle(async () => {
  const session = await guardAccess("stockLedger");
  await dbConnect();
  await User.updateOne({ _id: session.user.id }, { $set: { stockAlertsSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
});
