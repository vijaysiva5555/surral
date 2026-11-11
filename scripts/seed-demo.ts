/* Run: npm run seed-demo — adds sample BOMs, quotations (Equipment and Spare) and project offers without re-importing customers */
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
