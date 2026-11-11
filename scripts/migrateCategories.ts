/* One-off upgrade for data created before quotations and BOMs were split into Equipment / Spare sections.
   Idempotent: safe to run any number of times (npm run migrate-categories, and also run by the seed scripts).
   - quotations without a category become "spare"  (the only quotation section that existed before)
   - BOMs without a category become "equipment"     (matches the Bom model default and the /bom/[id] redirect)
   - drops the old unique indexes {seq, revision} on quotes and {name} on boms: they block the same number /
     the same BOM name in the other section. The per-category unique indexes replace them. */
import { Quote } from "../src/models/Quote";
import { Bom } from "../src/models/Bom";

async function dropIndexIfPresent(model: typeof Quote, name: string) {
  const indexes = await model.collection.indexes().catch(() => []);
  if (indexes.some((i) => i.name === name)) {
    await model.collection.dropIndex(name);
    console.log(`✔ dropped old index ${model.collection.collectionName}.${name}`);
  }
}

export async function migrateLegacyCategories() {
  const q = await Quote.updateMany({ category: { $exists: false } }, { $set: { category: "spare" } });
  const b = await Bom.updateMany({ category: { $exists: false } }, { $set: { category: "equipment" } });
  if (q.modifiedCount) console.log(`✔ ${q.modifiedCount} older quotation(s) moved to the Spare section`);
  if (b.modifiedCount) console.log(`✔ ${b.modifiedCount} older BOM(s) moved to the Equipment section`);
  await dropIndexIfPresent(Quote, "seq_1_revision_1");
  await dropIndexIfPresent(Bom, "name_1");
  await Promise.all([Quote.syncIndexes(), Bom.syncIndexes()]);   // make sure the per-category unique indexes exist
}
