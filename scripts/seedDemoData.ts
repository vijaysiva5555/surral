/* Demo data for every section: Equipment (BOMs + quotations), Spare (BOMs + quotations) and Project offers.
   Idempotent per section: a section that already has its demo records is left alone. Safe to run after npm run seed. */
import type { QuoteInput } from "../src/lib/schemas";
import { bomSummary, consistsOf, type BomItem } from "../src/lib/bomCalc";
import { derive, snapCompany, snapCustomer } from "../src/lib/quoteBuild";
import { DEFAULT_TERMS, financialYear, type QuoteLine } from "../src/lib/quoteCalc";
import { nextProjectSeq, nextQuoteSeq } from "../src/lib/nextNumber";
import { formatQuoteNumber, quotePrefixFor, quoteStartNo, type QuoteCategory } from "../src/lib/quoteCategory";
import {
  DEFAULT_EXCLUSIONS, DEFAULT_PROJECT_TERMS, defaultIntro, projectNumberPrefix, projectTotals,
  snapProjectCompany, snapProjectCustomer,
} from "../src/lib/projectQuote";
import { Bom } from "../src/models/Bom";
import { Quote } from "../src/models/Quote";
import { ProjectQuote } from "../src/models/ProjectQuote";
import { Customer } from "../src/models/Customer";
import { Company } from "../src/models/Company";
import { User } from "../src/models/User";
import { migrateLegacyCategories } from "./migrateCategories";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** stored in referredBy so demo quotations can be recognised (and removed) later */
export const DEMO_QUOTE_MARKER = "__seed_demo__";
const marker = (c: QuoteCategory) => `${DEMO_QUOTE_MARKER}${c}`;

const it = (make: string, description: string, qty: number, listPrice: number, discountPct: number, landed: number, marginPct = 20): BomItem =>
  ({ make, description, qty, listPrice, discountPct, landed, marginPct });

// ---------------------------------------------------------------- BOMs
export const DEMO_BOMS: Record<QuoteCategory, { name: string; items: BomItem[] }[]> = {
  equipment: [
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
  ],
  spare: [
    {
      name: "Triton Pump Service Kit",
      items: [
        it("241347", "Triton Diaphragm Repair Kit, PTFE", 1, 18450, 40, 0, 25),
        it("241348", "Triton Ball & Seat Kit, SST", 1, 12600, 40, 0, 25),
        it("241349", "Triton Air Valve Repair Kit", 1, 9850, 40, 0, 25),
        it("Surral", "O-rings, gaskets and consumables", 1, 0, 0, 1500),
        it("Surral", "Service labour at site (1 day)", 1, 0, 0, 6000, 0),
      ],
    },
    {
      name: "Airless Gun Overhaul Kit",
      items: [
        it("244067", "Gun Repair Kit, Contractor / FTx", 1, 6250, 40, 0, 25),
        it("287032", "Gun Filter, 60 Mesh, pack of 2", 2, 1350, 40, 0, 25),
        it("246453", "OneSeal Tip Gasket, pack of 5", 1, 2100, 40, 0, 25),
        it("243188", "RAC X SwitchTip, Green, 0.015 in", 2, 4200, 40, 0, 25),
      ],
    },
  ],
};

type LeanBom = { _id: unknown; name: string; date: Date; items: BomItem[] };

function packageLine(bom: LeanBom, id: string, hsn = "84242000"): QuoteLine {
  const s = bomSummary(bom);
  return {
    id, kind: "package", code: "Graco", description: bom.name, hsn, qty: 1, uom: "Set",
    basicPrice: s.price, discountPct: 0, subItems: consistsOf(bom), costPrice: s.landed,
    bom: { bomId: String(bom._id), name: bom.name, date: new Date(bom.date).toISOString().slice(0, 10), items: bom.items },
  };
}

function partLine(id: string, code: string, description: string, basicPrice: number, discountPct: number, qty = 1, hsn = "84249000"): QuoteLine {
  return {
    id, kind: "part", code, description, hsn, qty, uom: "Nos", basicPrice, discountPct, subItems: [],
    priceRef: { pn: code, pga: "", year: new Date().getFullYear(), listPrice: basicPrice },
  };
}

function customLine(id: string, description: string, basicPrice: number, qty = 1, uom = "Nos", hsn = "998719"): QuoteLine {
  return { id, kind: "custom", code: "Surral", description, hsn, qty, uom, basicPrice, discountPct: 0, subItems: [] };
}

// ---------------------------------------------------------------- helpers
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return iso(d); };
const contactOf = (c: any) => ({ name: c.contacts?.[0]?.name ?? "", phone: c.contacts?.[0]?.phone ?? "" });
const shortName = (c: any) => String(c.name).replace(/^M\/s\.?\s*/i, "").trim().slice(0, 40);

type Ctx = { admin: { _id: unknown; name: string; phone?: string }; company: any; customers: any[] };

async function createQuote(ctx: Ctx, category: QuoteCategory, customer: any, spec: {
  date: string; validityDays: number; status: string; lines: QuoteLine[]; taxType?: "auto" | "intra" | "inter";
}) {
  const input: QuoteInput = {
    category, customerId: String(customer._id), contact: contactOf(customer), date: spec.date,
    validityDays: spec.validityDays, referredBy: marker(category), gstRate: 18, taxType: spec.taxType ?? "auto",
    lines: spec.lines, terms: DEFAULT_TERMS(shortName(customer)), imageCaption: "", images: [],
  };
  const cs = snapCompany(ctx.company), cu = snapCustomer(customer, input.contact);
  const d = derive(input, cs, cu);
  const seq = await nextQuoteSeq(quoteStartNo(ctx.company, category), category);
  const fy = financialYear(d.date);
  return Quote.create({
    ...d, category, seq, revision: 0, fy, number: formatQuoteNumber(quotePrefixFor(ctx.company, category), seq, fy, category),
    status: spec.status, customerId: customer._id, customer: cu, company: cs,
    preparedBy: { name: ctx.admin.name, phone: ctx.admin.phone ?? "" },
    createdBy: String(ctx.admin._id), createdByName: ctx.admin.name,
  });
}

async function ensureBoms(ctx: Ctx, category: QuoteCategory) {
  for (const b of DEMO_BOMS[category]) {
    if (await Bom.exists({ category, name: b.name })) continue;
    await Bom.create({ category, name: b.name, date: new Date(), items: b.items, createdBy: String(ctx.admin._id), createdByName: ctx.admin.name });
    console.log(`✔ ${category} BOM: ${b.name}`);
  }
  const found = await Bom.find({ category, name: { $in: DEMO_BOMS[category].map((b) => b.name) } }).lean<LeanBom[]>();
  return Object.fromEntries(found.map((b) => [b.name, b])) as Record<string, LeanBom>;
}

// ---------------------------------------------------------------- sections
async function seedEquipment(ctx: Ctx) {
  const boms = await ensureBoms(ctx, "equipment");
  if (await Quote.exists({ category: "equipment", referredBy: marker("equipment") })) return console.log("• equipment demo quotations already exist");
  const [c1, c2, c3] = ctx.customers;
  const made = [
    await createQuote(ctx, "equipment", c1, { date: daysAgo(3), validityDays: 30, status: "draft",
      lines: [packageLine(boms["Triton Pump Air Spray Package"], "pkg-triton")] }),
    await createQuote(ctx, "equipment", c2, { date: daysAgo(12), validityDays: 45, status: "sent",
      lines: [packageLine(boms["Electric Airless Spray Package"], "pkg-electric"), customLine("install", "Installation, trial run and operator training", 15000, 1, "Job")] }),
    await createQuote(ctx, "equipment", c3, { date: daysAgo(28), validityDays: 30, status: "agree",
      lines: [packageLine(boms["Heavy-Duty Texture Sprayer Package"], "pkg-texture"),
        partLine("part-pump", "233776", "Triton Air-Operated Diaphragm Pump, Bare, Aluminum, BSPP", 105860, 40, 1, "84138120")] }),
  ];
  console.log(`✔ equipment quotations: ${made.map((q) => `${q.number} (${q.status})`).join(", ")}`);
}

async function seedSpare(ctx: Ctx) {
  const boms = await ensureBoms(ctx, "spare");
  if (await Quote.exists({ category: "spare", referredBy: marker("spare") })) return console.log("• spare demo quotations already exist");
  const [c1, c2, c3, c4] = ctx.customers;
  const made = [
    await createQuote(ctx, "spare", c2, { date: daysAgo(2), validityDays: 30, status: "draft", lines: [
      partLine("p1", "243188", "RAC X SwitchTip, Green, 0.015 in", 4200, 40, 10),
      partLine("p2", "246453", "OneSeal Tip Gasket, pack of 5", 2100, 40, 4),
      partLine("p3", "287032", "Gun Filter, 60 Mesh, pack of 2", 1350, 40, 6),
    ] }),
    await createQuote(ctx, "spare", c4, { date: daysAgo(9), validityDays: 30, status: "sent", lines: [
      packageLine(boms["Triton Pump Service Kit"], "pkg-triton-kit", "84139190"),
      partLine("p4", "214570", "FILTER, FLUID", 30980, 40, 1),
    ] }),
    await createQuote(ctx, "spare", c3, { date: daysAgo(20), validityDays: 30, status: "agree", lines: [
      packageLine(boms["Airless Gun Overhaul Kit"], "pkg-gun-kit", "84249000"),
      partLine("p5", "288428", "BlueMax II Hose, 1/4 in x 50 ft", 28500, 40, 2, "40093100"),
    ] }),
    await createQuote(ctx, "spare", c1, { date: daysAgo(40), validityDays: 30, status: "rejected", lines: [
      partLine("p6", "241347", "Triton Diaphragm Repair Kit, PTFE", 18450, 35, 3),
      partLine("p7", "241348", "Triton Ball & Seat Kit, SST", 12600, 35, 3),
    ] }),
  ];
  console.log(`✔ spare quotations: ${made.map((q) => `${q.number} (${q.status})`).join(", ")}`);
}

const DEMO_PROJECTS = [
  {
    subject: "Promix 2KS Plural Component Proportioner System",
    status: "sent", age: 6,
    technicalTitle: "Technical Specification – Promix 2KS",
    equipmentGraco: ["Promix 2KS Wall-Mount Proportioner", "Merkur 30:1 Pump Package (2 Nos)", "Pro Xp 60 Electrostatic Air Spray Gun"],
    equipmentSurral: ["SS Paint Tanks 60 Ltr with Agitator (2 Nos)", "Mounting Frame and Pipeline", "Air Filter Regulator Unit"],
    specs: [
      { label: "Mix ratio", value: "0.1:1 to 50:1" },
      { label: "Fluid flow", value: "Up to 3.8 lpm" },
      { label: "Max working pressure", value: "275 bar" },
      { label: "Power supply", value: "230 V, 50 Hz, single phase" },
    ],
    offers: [
      {
        title: "1. Offer – Promix 2KS System",
        items: [
          { description: "Promix 2KS plural component system with Graco pumps and gun", qty: "1 Set", unitPrice: 1850000 },
          { description: "Installation, commissioning and training at site", qty: "1 Job", unitPrice: 75000 },
        ],
        consists: [
          { description: "Promix 2KS controller with colour change module", qty: "1 No" },
          { description: "Merkur 30:1 pump package", qty: "2 Nos" },
          { description: "Pro Xp 60 electrostatic gun with hose", qty: "1 No" },
          { description: "SS paint tanks with agitator", qty: "2 Nos" },
        ],
      },
    ],
  },
  {
    subject: "Automatic Airless Spray Line for Chassis Painting",
    status: "draft", age: 1,
    technicalTitle: "Technical Specification – Automatic Spray Line",
    equipmentGraco: ["King 45:1 Airless Pump Package", "AL Plus Automatic Airless Gun (4 Nos)", "Fluid Filter and Regulator"],
    equipmentSurral: ["Gun mounting brackets", "Paint circulation pipeline", "Control panel enclosure"],
    specs: [
      { label: "Line speed", value: "1.5 m/min" },
      { label: "Paint", value: "PU / Epoxy primer" },
      { label: "Air requirement", value: "4 – 5 bar constant" },
    ],
    offers: [
      {
        title: "1. Offer – 4-Gun Automatic System",
        items: [{ description: "Automatic airless spray system with 4 guns", qty: "1 Set", unitPrice: 1240000 }],
        consists: [
          { description: "King 45:1 airless pump package", qty: "1 No" },
          { description: "AL Plus automatic airless gun", qty: "4 Nos" },
          { description: "Paint circulation pipeline", qty: "1 Lot" },
        ],
      },
      {
        title: "2. Offer – 2-Gun Automatic System",
        items: [{ description: "Automatic airless spray system with 2 guns", qty: "1 Set", unitPrice: 780000 }],
        consists: [
          { description: "King 45:1 airless pump package", qty: "1 No" },
          { description: "AL Plus automatic airless gun", qty: "2 Nos" },
        ],
      },
    ],
  },
];

async function seedProject(ctx: Ctx) {
  if (await ProjectQuote.exists({ subject: { $in: DEMO_PROJECTS.map((p) => p.subject) } })) return console.log("• project demo offers already exist");
  const made: string[] = [];
  for (const [n, p] of DEMO_PROJECTS.entries()) {
    const customer = ctx.customers[(n + 4) % ctx.customers.length];
    const date = new Date(daysAgo(p.age) + "T12:00:00Z");
    const seq = await nextProjectSeq(ctx.company.projectStartNo ?? 1);
    const fy = financialYear(date);
    const terms = DEFAULT_PROJECT_TERMS();
    const doc = await ProjectQuote.create({
      date, seq, fy, number: `${ctx.company.projectPrefix || projectNumberPrefix(ctx.company)}/${seq}/${fy}`, status: p.status,
      customerId: customer._id, customer: snapProjectCustomer(customer, contactOf(customer)), company: snapProjectCompany(ctx.company),
      subject: p.subject, intro: defaultIntro(p.subject),
      preparedBy: ctx.admin.name, approvedBy: ctx.admin.name, signerName: ctx.admin.name, signerPhone: ctx.admin.phone ?? "", signerEmail: ctx.company.email ?? "",
      equipmentGraco: p.equipmentGraco, equipmentSurral: p.equipmentSurral, technicalTitle: p.technicalTitle, specs: p.specs,
      offers: p.offers, exclusions: DEFAULT_EXCLUSIONS, terms,
      totals: projectTotals(p.offers, terms.find((t) => /tax/i.test(t.label))?.value || "GST 18% Extra"),
      createdBy: String(ctx.admin._id), createdByName: ctx.admin.name,
    });
    made.push(`${doc.number} (${doc.status})`);
  }
  console.log(`✔ project offers: ${made.join(", ")}`);
}

/** Sample BOMs, quotations and project offers so every section of the app has something to show */
export async function seedDemoData() {
  await migrateLegacyCategories();

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@surral.in").toLowerCase();
  const admin = await User.findOne({ email: adminEmail }).lean<any>();
  if (!admin) return console.log("⚠ demo data skipped – admin user not found (run full seed first)");
  const [company, customers] = await Promise.all([
    Company.findOne().lean<any>(),
    Customer.find({ active: true }).sort({ name: 1 }).limit(6).lean<any[]>(),
  ]);
  if (!company) return console.log("⚠ demo data skipped – company profile missing");
  if (!customers.length) return console.log("⚠ demo data skipped – no customers (import customers first)");
  while (customers.length < 6) customers.push(customers[customers.length % customers.length]);   // fewer customers: reuse them

  const ctx: Ctx = { admin: { _id: admin._id, name: admin.name, phone: admin.phone }, company, customers };
  await seedEquipment(ctx);
  await seedSpare(ctx);
  await seedProject(ctx);
}
