/* Run: npm run import-prices -- "<file.xlsx>"  — imports a Graco India INR price list (same logic as Pricing > Import price list) */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { dbConnect } from "../src/lib/db";
import { parsePriceWorkbook } from "../src/lib/priceImport";
import { Part } from "../src/models/Part";
import { PartPrice } from "../src/models/PartPrice";
import { PriceList } from "../src/models/PriceList";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npm run import-prices -- "<file.xlsx>"');
  const parsed = await parsePriceWorkbook(fs.readFileSync(file), path.basename(file));
  const { year, effectiveFrom: effStr } = parsed;
  if (!year || !effStr) throw new Error(`Could not detect year/effective date (year=${year}, date=${effStr})`);
  if (!parsed.rows.length) throw new Error("No part rows found");
  const effectiveFrom = new Date(effStr + "T12:00:00Z");
  const name = `${year} India INR – effective ${effStr}`;
  console.log(`Parsed ${parsed.rows.length} parts · year ${year} · effective ${effStr}`);

  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lists = await PriceList.find().lean<any[]>();
  const same = lists.find((l) => l.year === year);
  const latestOther = lists.filter((l) => String(l._id) !== String(same?._id)).sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)[0];
  const isLatest = !latestOther || effectiveFrom >= latestOther.effectiveFrom;

  const fields = { name, effectiveFrom, sourceFile: path.basename(file), itemCount: parsed.rows.length, importedBy: "import script" };
  const pl = same ? await PriceList.findByIdAndUpdate(same._id, fields, { new: true }) : await PriceList.create({ year, ...fields });
  console.log(`${same ? "Replacing" : "Creating"} price list "${name}"`);

  for (let i = 0; i < parsed.rows.length; i += 2000) {
    await Part.bulkWrite(parsed.rows.slice(i, i + 2000).map((r) => {
      const attrs = { desc: r.desc, division: r.division, application: r.application, discountCode: r.discountCode, sbu: r.sbu, familyCode: r.familyCode, itemStatus: r.itemStatus, recordType: r.recordType };
      return { updateOne: { filter: { pn: r.pn, pga: r.pga }, update: isLatest ? { $set: attrs } : { $setOnInsert: attrs }, upsert: true } };
    }), { ordered: false });
    process.stdout.write(`\r  parts ${Math.min(i + 2000, parsed.rows.length)}/${parsed.rows.length}`);
  }
  console.log();
  await PartPrice.deleteMany({ priceListId: pl._id });
  for (let i = 0; i < parsed.rows.length; i += 5000) {
    await PartPrice.insertMany(parsed.rows.slice(i, i + 5000).map((r) => ({ priceListId: pl._id, pn: r.pn, pga: r.pga, listPrice: r.listPrice })), { ordered: false });
    process.stdout.write(`\r  prices ${Math.min(i + 5000, parsed.rows.length)}/${parsed.rows.length}`);
  }
  console.log();

  console.log(`✔ done. Parts in DB: ${await Part.countDocuments()} · prices in this list: ${await PartPrice.countDocuments({ priceListId: pl._id })} · price lists: ${await PriceList.countDocuments()}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
