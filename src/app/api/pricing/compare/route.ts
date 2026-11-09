/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { compareMaps, priceMap } from "@/lib/pricing";
import { Part } from "@/models/Part";

export const dynamic = "force-dynamic";

/** ?a=listId&b=listId&kind=changed|added|removed&q=&page=  — a = older list, b = newer list */
export const GET = (req: NextRequest) => handle(async () => {
  await guard();
  const sp = req.nextUrl.searchParams;
  const [a, b] = [sp.get("a"), sp.get("b")];
  if (!a || !b) return NextResponse.json({ error: "Choose two price lists" }, { status: 400 });
  await dbConnect();
  const [ma, mb] = await Promise.all([priceMap(a), priceMap(b)]);
  const c = compareMaps(ma, mb);
  const kind = sp.get("kind") ?? "changed";
  const q = (sp.get("q") ?? "").trim().toUpperCase();

  let rows: { key: string; a: number | null; b: number | null; pct: number | null }[] =
    kind === "added" ? c.added.map((k) => ({ key: k, a: null, b: mb.get(k)!, pct: null }))
    : kind === "removed" ? c.removed.map((k) => ({ key: k, a: ma.get(k)!, b: null, pct: null }))
    : c.changed;
  if (q) rows = rows.filter((r) => r.key.includes(q));
  if (kind === "changed") rows.sort((x, y) => Math.abs(y.pct ?? 0) - Math.abs(x.pct ?? 0));
  else rows.sort((x, y) => x.key.localeCompare(y.key));

  const page = Math.max(1, Number(sp.get("page")) || 1), limit = 50;
  const slice = rows.slice((page - 1) * limit, page * limit);
  const parts = await Part.find({ pn: { $in: slice.map((r) => r.key.split("|")[0]) } }).select("pn pga desc division discountCode").lean<any[]>();
  const meta = new Map(parts.map((p) => [`${p.pn}|${p.pga}`, p] as [string, any]));

  return NextResponse.json({
    summary: { listA: ma.size, listB: mb.size, added: c.added.length, removed: c.removed.length, changed: c.changed.length, unchanged: c.unchanged, avgPct: c.avgPct, medianPct: c.medianPct },
    total: rows.length, page, pages: Math.ceil(rows.length / limit),
    items: slice.map((r) => ({ ...r, pn: r.key.split("|")[0], pga: r.key.split("|")[1], part: meta.get(r.key) ?? null })),
  });
});
