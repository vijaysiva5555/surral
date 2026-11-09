/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { parsePriceWorkbook } from "@/lib/priceImport";
import { compareMaps, keyOf, priceMap } from "@/lib/pricing";
import { Part } from "@/models/Part";
import { PartPrice } from "@/models/PartPrice";
import { PriceList } from "@/models/PriceList";

export const maxDuration = 300;

/** multipart: file, mode=preview|commit, [year, name, effectiveFrom] */
export const POST = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin"]);
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Upload the Graco price list (.xlsx)" }, { status: 400 });
  const mode = fd.get("mode") === "commit" ? "commit" : "preview";

  const parsed = await parsePriceWorkbook(Buffer.from(await file.arrayBuffer()), file.name);
  if (!parsed.rows.length) return NextResponse.json({ error: "No part rows found in the file. Expected columns: Part Number, Part Description, PGA, Division, Application, Discount code, SBU, Family Code, List Price, Item Status." }, { status: 400 });
  const year = Number(fd.get("year")) || parsed.year;
  const effStr = String(fd.get("effectiveFrom") || parsed.effectiveFrom || "");
  const detected = { title: parsed.title, year: parsed.year, effectiveFrom: parsed.effectiveFrom };

  // Couldn't work out year / date: on preview let the user type them in (the wizard shows the fields); on commit refuse
  if (!year || !effStr) {
    if (mode === "preview")
      return NextResponse.json({ report: { detected, year: year || "", effectiveFrom: effStr, name: "", rows: parsed.rows.length, stats: parsed.stats, comparison: null, replacesExisting: null, needsInput: true } });
    return NextResponse.json({ error: "Enter the year and effective date." }, { status: 400 });
  }
  const effectiveFrom = new Date(effStr + "T12:00:00Z");
  if (isNaN(+effectiveFrom)) return NextResponse.json({ error: "Invalid effective date." }, { status: 400 });
  const name = String(fd.get("name") || `${year} India INR – effective ${effStr}`);

  await dbConnect();
  const lists = await PriceList.find().sort({ effectiveFrom: -1 }).lean<any[]>();
  const same = lists.find((l) => l.year === year);
  const prev = lists.find((l) => l.effectiveFrom < effectiveFrom && String(l._id) !== String(same?._id));

  const newMap = new Map(parsed.rows.map((r) => [keyOf(r.pn, r.pga), r.listPrice]));
  let comparison = null;
  if (prev) {
    const c = compareMaps(await priceMap(prev._id), newMap);
    comparison = { against: prev.name, added: c.added.length, removed: c.removed.length, changed: c.changed.length, unchanged: c.unchanged, avgPct: c.avgPct, medianPct: c.medianPct };
  }
  const report = { detected, year, effectiveFrom: effStr, name, rows: parsed.rows.length, stats: parsed.stats, comparison, replacesExisting: same?.name ?? null };
  if (mode === "preview") return NextResponse.json({ report });

  // ---- commit ----
  const latestOther = lists.find((l) => String(l._id) !== String(same?._id));
  const isLatest = !latestOther || effectiveFrom >= latestOther.effectiveFrom;

  const pl = same
    ? await PriceList.findByIdAndUpdate(same._id, { name, effectiveFrom, sourceFile: file.name, itemCount: parsed.rows.length, importedBy: session.user.name }, { new: true })
    : await PriceList.create({ year, name, effectiveFrom, sourceFile: file.name, itemCount: parsed.rows.length, importedBy: session.user.name });

  // parts (static attributes): refresh only from the newest list; older lists just add missing parts
  for (let i = 0; i < parsed.rows.length; i += 2000) {
    await Part.bulkWrite(parsed.rows.slice(i, i + 2000).map((r) => {
      const attrs = { desc: r.desc, division: r.division, application: r.application, discountCode: r.discountCode, sbu: r.sbu, familyCode: r.familyCode, itemStatus: r.itemStatus, recordType: r.recordType };
      return { updateOne: { filter: { pn: r.pn, pga: r.pga }, update: isLatest ? { $set: attrs } : { $setOnInsert: attrs }, upsert: true } };
    }), { ordered: false });
  }
  await PartPrice.deleteMany({ priceListId: pl._id });
  for (let i = 0; i < parsed.rows.length; i += 5000)
    await PartPrice.insertMany(parsed.rows.slice(i, i + 5000).map((r) => ({ priceListId: pl._id, pn: r.pn, pga: r.pga, listPrice: r.listPrice })), { ordered: false });

  await audit(session, same ? "reimport" : "import", "priceList", String(pl._id), `${name}: ${parsed.rows.length} parts from ${file.name}`);
  return NextResponse.json({ report, priceListId: pl._id, imported: parsed.rows.length });
});
