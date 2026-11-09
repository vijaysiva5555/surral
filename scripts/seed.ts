/* Run: npm run seed  — creates the admin user, Surral company profile and imports data/Customer_Details.xlsx */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { dbConnect } from "../src/lib/db";
import { User } from "../src/models/User";
import { Company } from "../src/models/Company";
import { Customer } from "../src/models/Customer";
import { parseCustomerWorkbook } from "../src/lib/customerImport";
import { seedDemoData } from "./seedDemoData";

async function main() {
  await dbConnect();

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@surral.in").toLowerCase();
  if (!(await User.findOne({ email }))) {
    await User.create({ name: "Administrator", email, role: "admin", passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "Admin@123", 10) });
    console.log(`✔ admin user created: ${email}`);
  } else console.log(`• admin user exists: ${email}`);

  if (!(await Company.findOne())) {
    await Company.create({
      name: "SURRAL SURFACE COATINGS PVT. LTD",
      tagline: "Authorised Distributor for M/s.Graco Inc - USA",
      addressLines: ["Plot No. 68-B Survey No: 316/37,", "Morai Industrial Area, Avadi, Chennai - 600055."],
      state: "Tamil Nadu", stateCode: "33", gstin: "33AAMCS1832R2ZT",
      phone: "8122626435", mobile: "9940498394/5", website: "www.surral.in", quotePrefix: "SSCPL/SQ", quoteStartNo: 2489,
    });
    console.log("✔ company profile created (taken from the Simpson quotation header)");
  }

  const file = path.join(process.cwd(), "data", "Customer_Details.xlsx");
  const parsed = await parseCustomerWorkbook(fs.readFileSync(file));
  let created = 0, updated = 0;
  for (const c of parsed) {
    const ex = await Customer.findOne(c.gstin ? { gstin: c.gstin } : { name: c.name });
    if (ex) { await ex.set(c).save(); updated++; } else { await Customer.create(c); created++; }
  }
  console.log(`✔ customers: ${parsed.length} read, ${created} created, ${updated} updated`);

  await seedDemoData();
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
