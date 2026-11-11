/* Run: npm run migrate-categories — moves pre-split quotations / BOMs into a section and drops the old unique indexes */
import mongoose from "mongoose";
import { dbConnect } from "../src/lib/db";
import { migrateLegacyCategories } from "./migrateCategories";

async function main() {
  await dbConnect();
  await migrateLegacyCategories();
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
