/* Run: npm run seed-demo — adds BOM samples and demo quotations without re-importing customers */
import mongoose from "mongoose";
import { dbConnect } from "../src/lib/db";
import { seedDemoData } from "./seedDemoData";

async function main() {
  await dbConnect();
  await seedDemoData();
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
