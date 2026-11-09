/* Demo BOM packages and quotations — idempotent; safe to run after npm run seed */
import type { QuoteInput } from "../src/lib/schemas";
import { bomSummary, consistsOf, type BomItem } from "../src/lib/bomCalc";
import { derive, snapCompany, snapCustomer } from "../src/lib/quoteBuild";
import { DEFAULT_TERMS, financialYear, type QuoteLine } from "../src/lib/quoteCalc";
import { nextQuoteSeq } from "../src/lib/nextNumber";
import { Bom } from "../src/models/Bom";
import { Quote } from "../src/models/Quote";
import { Customer } from "../src/models/Customer";
import { Company } from "../src/models/Company";
import { User } from "../src/models/User";

export const DEMO_QUOTE_MARKER = "__seed_demo__";

const it = (make: string, description: string, qty: number, listPrice: number, discountPct: number, landed: number, marginPct = 20): BomItem =>
  ({ make, description, qty, listPrice, discountPct, landed, marginPct });

export const DEMO_BOMS: { name: string; items: BomItem[] }[] = [
  {
    name: "Triton Pump Air Spray Package",
    items: [
      it("233776", "Triton Air-Operated Diaphragm Pump, Bare, Aluminum, BSPP", 1, 105860, 40, 0),
      it("Durrr", "Imported Air Spray Gun", 1, 0, 0, 22000),
      it("214706", "Low Pressure Fluid Regulator, 250 Max psi, 5-100 psi Range, 3.0 GPM, SST", 1, 47460, 40, 0),
      it("214570", "FILTER, FLUID", 1, 30980, 40, 0),
      it("Surral", "3 Ltr Hopper SS", 1, 0, 0, 3500),
      it("Surral", "Surral Make 4-Leg Stand", 1, 0, 0, 3500),
      it("Surral", '1/4" Paint and Air Hose 7.5 Mtr Long with End Fittings', 1, 0, 0, 4500),
      it("Surral", "Air Regulator with Gauge for Pump & Gun", 2, 0, 0, 2700),
      it("Surral", "Suction Hose Arrangement", 1, 0, 0, 4500),
      it("Surral", "Fittings and Accessories", 1, 0, 0, 5000),
    ],
  },
  {
    name: "Electric Airless Spray Package",
    items: [
      it("17C284", "Ultra Max II 695 PC Pro Electric Airless Sprayer", 1, 245000, 40, 0),
      it("288428", "BlueMax II Hose, 1/4 in x 50 ft", 1, 28500, 40, 0),
      it("243188", "RAC X SwitchTip, Green, 0.015 in", 2, 4200, 40, 0),
      it("Surral", "Gun extension and whip hose kit", 1, 0, 0, 8500),
      it("Surral", "Fittings and accessories", 1, 0, 0, 3500),
    ],
  },
  {
    name: "Heavy-Duty Texture Sprayer Package",
    items: [
      it("25M793", "TexSpray Mark V Electric Texture Sprayer", 1, 385000, 40, 0),
      it("Surral", "Material hopper and stand", 1, 0, 0, 12000),
      it("Surral", "High-pressure texture hose 15 m", 1, 0, 0, 9500),
      it("Surral", "Fittings and accessories", 1, 0, 0, 4500),
    ],
  },
];

type LeanBomForPackageLine = { _id: unknown; name: string; date: Date; items: BomItem[] };

function packageLine(bom: LeanBomForPackageLine, id: string, hsn = "84242000"): QuoteLine {
  const s = bomSummary(bom);
  return {
    id,
    kind: "package",
    code: "Graco",
    description: bom.name,
    hsn,
    qty: 1,
    uom: "Set",
    basicPrice: s.price,
    discountPct: 0,
    subItems: consistsOf(bom),
    costPrice: s.landed,
    bom: { bomId: String(bom._id), name: bom.name, date: String(bom.date).slice(0, 10), items: bom.items },
  };
}

function partLine(id: string, code: string, description: string, basicPrice: number, discountPct: number, qty = 1): QuoteLine {
  return {
    id,
    kind: "part",
    code,
    description,
    hsn: "84138120",
    qty,
    uom: "Nos",
    basicPrice,
    discountPct,
    subItems: [],
    priceRef: { pn: code, pga: "", year: new Date().getFullYear(), listPrice: basicPrice },
  };
}

async function createQuote(
  admin: { _id: unknown; name: string },
  company: Record<string, unknown>,
  customer: Record<string, unknown>,
  input: QuoteInput,
  extra: { status: string; approvalStatus?: string; approvedAt?: Date; approvedBy?: string; approvedByName?: string },
) {
  const cs = snapCompany(company);
  const contact = input.contact ?? { name: "", phone: "" };
  const cu = snapCustomer(customer, contact);
  const d = derive(input, cs, cu);
  const seq = await nextQuoteSeq((company.quoteStartNo as number) ?? 1);
  const fy = financialYear(d.date);
  const short = String(customer.name).replace(/^M\/s\.?\s*/i, "").trim().slice(0, 40);
  return Quote.create({
    ...d,
    seq,
    revision: 0,
    fy,
    number: `${company.quotePrefix}/${seq}/${fy}`,
    status: extra.status,
    approvalStatus: extra.approvalStatus ?? "approved",
    approvedAt: extra.approvedAt ?? new Date(),
    approvedBy: extra.approvedBy ?? String(admin._id),
    approvedByName: extra.approvedByName ?? admin.name,
    customerId: customer._id,
    customer: cu,
    company: cs,
    preparedBy: { name: admin.name, phone: "" },
    createdBy: String(admin._id),
    createdByName: admin.name,
    referredBy: DEMO_QUOTE_MARKER,
    terms: input.terms.length ? input.terms : DEFAULT_TERMS(short),
  });
}

/** Creates sample BOMs (by unique name) and a few quotations for the dashboard and BOM picker */
export async function seedDemoData() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@surral.in").toLowerCase();
  const admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    console.log("⚠ demo data skipped – admin user not found (run full seed first)");
    return;
  }

  for (const b of DEMO_BOMS) {
    if (!(await Bom.exists({ name: b.name }))) {
      await Bom.create({
        name: b.name,
        date: new Date(),
        items: b.items,
        createdBy: String(admin._id),
        createdByName: "Seed script",
      });
      console.log(`✔ sample BOM: ${b.name}`);
    }
  }

  if (await Quote.exists({ referredBy: DEMO_QUOTE_MARKER })) {
    console.log("• demo quotations already exist");
    return;
  }

  const [company, customer] = await Promise.all([
    Company.findOne().lean<Record<string, unknown>>(),
    Customer.findOne({ active: true }).sort({ name: 1 }).lean<Record<string, unknown>>(),
  ]);
  if (!company) {
    console.log("⚠ demo quotations skipped – company profile missing");
    return;
  }
  if (!customer) {
    console.log("⚠ demo quotations skipped – no customers (import customers first)");
    return;
  }

  const [triton, electric, texture] = await Promise.all([
    Bom.findOne({ name: "Triton Pump Air Spray Package" }).lean<LeanBomForPackageLine>(),
    Bom.findOne({ name: "Electric Airless Spray Package" }).lean<LeanBomForPackageLine>(),
    Bom.findOne({ name: "Heavy-Duty Texture Sprayer Package" }).lean<LeanBomForPackageLine>(),
  ]);
  if (!triton || !electric || !texture) {
    console.log("⚠ demo quotations skipped – BOM packages not found");
    return;
  }

  const contact = {
    name: (customer.contacts as { name?: string }[])?.[0]?.name ?? "",
    phone: (customer.contacts as { phone?: string }[])?.[0]?.phone ?? "",
  };
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - n);
    return iso(d);
  };

  const adminLean = { _id: admin._id, name: admin.name };

  const q1 = await createQuote(adminLean, company, customer, {
    customerId: String(customer._id),
    contact,
    date: daysAgo(3),
    validityDays: 30,
    referredBy: DEMO_QUOTE_MARKER,
    gstRate: 18,
    lines: [packageLine(triton, "pkg-triton")],
    terms: [],
    imageCaption: "",
  }, { status: "draft", approvalStatus: "approved" });

  const q2 = await createQuote(adminLean, company, customer, {
    customerId: String(customer._id),
    contact,
    date: daysAgo(12),
    validityDays: 45,
    referredBy: DEMO_QUOTE_MARKER,
    gstRate: 18,
    lines: [packageLine(electric, "pkg-electric")],
    terms: [],
    imageCaption: "",
  }, { status: "sent", approvalStatus: "approved" });

  const q3 = await createQuote(adminLean, company, customer, {
    customerId: String(customer._id),
    contact,
    date: daysAgo(28),
    validityDays: 30,
    referredBy: DEMO_QUOTE_MARKER,
    gstRate: 18,
    lines: [
      packageLine(texture, "pkg-texture"),
      partLine("part-pump", "233776", "Triton Air-Operated Diaphragm Pump, Bare, Aluminum, BSPP", 105860, 40),
    ],
    terms: [],
    imageCaption: "",
  }, { status: "agree", approvalStatus: "approved" });

  console.log(`✔ demo quotations: ${q1.number} (draft), ${q2.number} (sent), ${q3.number} (agree) for ${customer.name}`);
}
