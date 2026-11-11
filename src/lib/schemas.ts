import { z } from "zod";
import { GSTIN_RE, cleanGstin } from "./india";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Company name is required"),
  addressLines: z.array(z.string().trim()).transform((a) => a.filter(Boolean)),
  pincode: z.string().trim().regex(/^(\d{6})?$/, "Pincode must be 6 digits").optional().default(""),
  gstin: z.string().transform(cleanGstin).refine((g) => g === "" || GSTIN_RE.test(g), "Invalid GSTIN format"),
  contacts: z.array(z.object({
    name: z.string().trim().default(""), phone: z.string().trim().default(""),
    email: z.string().trim().default(""), designation: z.string().trim().default(""),
  })).default([]),
  standardDiscountPct: z.coerce.number().min(0).max(100).default(0),
  active: z.boolean().default(true),
});

// ---------------- quotations ----------------
const num = (d = 0) => z.coerce.number().catch(d);
const bomItem = z.object({ make: z.string().default(""), description: z.string().default(""), qty: z.coerce.number().positive("Quantity must be more than 0"), listPrice: num(), discountPct: num(), landed: num(), marginPct: num(20) });
export const bomSchema = z.object({
  category: z.enum(["spare", "equipment"]).optional(),
  name: z.string().trim().min(2, "BOM name is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the BOM date"),
  image: z.string().max(2_000_000, "Image is too large").nullish(),
  items: z.array(bomItem).transform((a) => a.filter((i) => i.make.trim() || i.description.trim() || i.listPrice || i.landed)).pipe(z.array(bomItem).min(1, "Add at least one item")),
});
export type BomInput = z.infer<typeof bomSchema>;
export const lineSchema = z.object({
  id: z.string(), kind: z.enum(["part", "package", "custom"]),
  code: z.string().default(""), description: z.string().trim().min(1, "Every item needs a description"), hsn: z.string().default(""),
  qty: z.coerce.number().positive("Quantity must be more than 0"), uom: z.string().default("Nos"),
  basicPrice: z.coerce.number().min(0, "Price cannot be negative"), discountPct: z.coerce.number().min(0).max(100).default(0),
  subItems: z.array(z.string()).default([]).transform((a) => a.map((s) => s.trim()).filter(Boolean)),
  costPrice: z.coerce.number().optional(),
  agreement: z.string().optional(),
  priceRef: z.object({ pn: z.string(), pga: z.string(), year: z.number(), listPrice: z.number() }).optional(),
  bom: z.object({ bomId: z.string().optional(), name: z.string().default(""), date: z.string().optional(), items: z.array(bomItem) }).optional(),
});
export const quoteInputSchema = z.object({
  category: z.enum(["spare", "equipment"]).optional(),
  customerId: z.string().min(1, "Select a customer"),
  contact: z.object({ name: z.string().default(""), phone: z.string().default("") }).default({ name: "", phone: "" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the quotation date"),
  validityDays: z.coerce.number().int().min(1).max(365).default(30),
  referredBy: z.string().trim().default(""),
  priceListId: z.string().nullable().optional(),
  gstRate: z.coerce.number().min(0).max(28).default(18),
  taxType: z.enum(["auto", "intra", "inter"]).default("auto"),
  lines: z.array(lineSchema).min(1, "Add at least one item"),
  terms: z.array(z.object({ label: z.string().default(""), value: z.string().default("") })).default([]),
  image: z.string().max(2_000_000, "Image is too large").optional().nullable(),
  imageCaption: z.string().default(""),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export const partSchema = z.object({
  pn: z.string().trim().min(1, "Part number is required").transform((s) => s.toUpperCase()),
  pga: z.string().trim().default(""),
  desc: z.string().trim().default(""),
  division: z.string().trim().default(""),
  application: z.string().trim().default(""),
  discountCode: z.string().trim().default(""),
  sbu: z.string().trim().default(""),
  familyCode: z.string().trim().default(""),
  itemStatus: z.string().trim().default(""),
  recordType: z.string().trim().default(""),
  hsn: z.string().trim().regex(/^(\d{4,8})?$/, "HSN must be 4 to 8 digits").default(""),
  partnerDiscountPct: z.number().min(0).max(100).nullable().default(null),
  prices: z.array(z.object({ priceListId: z.string().min(1), listPrice: z.number().min(0).nullable() })).default([]),
});
export type PartInput = z.infer<typeof partSchema>;

export const hsnSchema = z.object({ code: z.string().trim().regex(/^\d{4,8}$/, "HSN must be 4 to 8 digits"), description: z.string().trim().default(""), gstRate: z.coerce.number().min(0).max(28).default(18), active: z.boolean().default(true) });

export const termTemplateSchema = z.object({
  name: z.string().trim().min(2, "Template name is required"),
  isDefault: z.boolean().default(false),
  terms: z.array(z.object({ label: z.string().default(""), value: z.string().default("") })).transform((a) => a.filter((t) => t.label.trim() || t.value.trim())),
});
