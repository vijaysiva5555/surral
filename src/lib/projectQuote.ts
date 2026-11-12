import { z } from "zod";
import { amountInWords, r2 } from "./quoteCalc";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProjectContact = { name: string; phone: string };

export const MAX_OFFER_IMAGES = 6;
const OFFER_IMAGE_KEY = /^[\w-]+\/offers\/\d{4}\/[0-9a-f-]{36}\.(jpg|png)$/;
/** every S3 key referenced by a project quotation's offers (for clean-up when images are removed) */
export const offerImageKeys = (offers: any[] | undefined): string[] => (offers ?? []).flatMap((o) => o?.images ?? []);

export const projectLineSchema = z.object({
  description: z.string().trim().default(""),
  qty: z.string().trim().default("1"),
  unitPrice: z.coerce.number().min(0).default(0),
});
export const projectConsistSchema = z.object({
  description: z.string().trim().default(""),
  qty: z.string().trim().default(""),
});
export const projectOfferSchema = z.object({
  title: z.string().trim().default(""),
  items: z.array(projectLineSchema).default([]),
  consists: z.array(projectConsistSchema).default([]),
  /** photos of the offered equipment – S3 keys from /api/uploads (surral/offers/<yyyy>/<uuid>.jpg) */
  images: z.array(
    z.string().regex(OFFER_IMAGE_KEY, "Only uploaded images can be attached to an offer"),
  ).max(MAX_OFFER_IMAGES, `Up to ${MAX_OFFER_IMAGES} images per offer`).default([]),
});

export const projectQuoteInputSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  contact: z.object({ name: z.string().default(""), phone: z.string().default("") }).default({ name: "", phone: "" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the offer date"),
  subject: z.string().trim().default(""),
  intro: z.string().trim().default(""),
  preparedBy: z.string().trim().default(""),
  approvedBy: z.string().trim().default(""),
  signerName: z.string().trim().default(""),
  signerPhone: z.string().trim().default(""),
  signerEmail: z.string().trim().default(""),
  equipmentGraco: z.array(z.string()).default([]).transform((a) => a.map((s) => s.trim()).filter(Boolean)),
  equipmentSurral: z.array(z.string()).default([]).transform((a) => a.map((s) => s.trim()).filter(Boolean)),
  technicalTitle: z.string().trim().default(""),
  specs: z.array(z.object({ label: z.string().trim().default(""), value: z.string().trim().default("") }))
    .default([]).transform((a) => a.filter((s) => s.label || s.value)),
  offers: z.array(projectOfferSchema).default([]),
  exclusions: z.array(z.string()).default([]).transform((a) => a.map((s) => s.trim()).filter(Boolean)),
  terms: z.array(z.object({ label: z.string().trim().default(""), value: z.string().default("") }))
    .default([]).transform((a) => a.filter((t) => t.label || t.value)),
});
export type ProjectQuoteInput = z.infer<typeof projectQuoteInputSchema>;

const qtyNum = (q: string) => {
  const n = parseFloat(String(q).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 1;
};

/** offer totals are always recomputed from the lines, never trusted from the client */
export function projectTotals(offers: any[], gstNote: string) {
  const total = r2((offers ?? []).reduce((sum, o) => sum + (o.items ?? []).reduce((s: number, l: any) => s + qtyNum(l.qty) * (Number(l.unitPrice) || 0), 0), 0));
  return { total, words: amountInWords(total), gstNote };
}

export const snapProjectCompany = (c: any) => ({
  name: c.name, tagline: c.tagline, addressLines: c.addressLines, state: c.state, stateCode: c.stateCode,
  gstin: c.gstin, phone: c.phone, mobile: c.mobile, website: c.website, email: c.email,
});
export const snapProjectCustomer = (c: any, contact: ProjectContact) => ({
  name: c.name, addressLines: c.addressLines, pincode: c.pincode, gstin: c.gstin,
  state: c.state, stateCode: c.stateCode, contact,
});

export const projectNumberPrefix = (company: any) => {
  const p = String(company?.quotePrefix ?? "").trim();
  if (!p) return "SSCPL/QT";
  return p.replace(/\/SQ$/i, "/QT");
};

/** the term blocks printed on every project offer — editable per quotation */
export const DEFAULT_PROJECT_TERMS = (): { label: string; value: string }[] => [
  { label: "Taxes", value: "GST 18% extra." },
  { label: "Payment", value: "50% advance along with Purchase Order, 40% with 100% Taxes & Duties against Proforma Invoice, 10% against Installation & Commissioning." },
  { label: "Delivery", value: "12 – 14 weeks from the date of your PO." },
  { label: "Transportation / Freight", value: "Packing & Freight: Extra as above mentioned." },
  { label: "Validity", value: "Offer valid for 30 days. To extend its validity, contact us." },
  { label: "Site Installation", value: "As per request from Customer. Please give us at least 7 days notice of site readiness; erection & commissioning will be completed within 2 weeks." },
  { label: "Jurisdiction", value: "Chennai." },
  { label: "Confidentiality", value: "All the technical and commercial information enclosed in this offer is confidential and cannot be communicated to any third party without Surral Surface Coatings Pvt Ltd written agreement." },
  { label: "Force Majeure", value: "Our offer is subject to the force majeure clause and as such we will not be responsible for delay in the delivery of equipment due to war, emergency, revolution, accidental fire, floods or any such natural calamities which are beyond our control. All typographical and clerical errors are subject to correction." },
];

export const DEFAULT_EXCLUSIONS = [
  "Gun Mounting Arrangement",
  "Gun On-Off Logic",
  "PLC",
  "Programming",
  "Paint Level in the Tank Automation",
  "Air line Near to the system",
  "Air Pressure 4 – 5 Bar constant",
];

export const defaultIntro = (subject: string) =>
  `As discussed with you we offered for ${subject || "the system"} with Graco accessories and locally sourced accessories. Please go through same.`;

export const emptyOffer = (n: number) => ({
  title: `${n}. Offer`,
  items: [{ description: "", qty: "1 Set", unitPrice: 0 }],
  consists: [{ description: "", qty: "" }],
  images: [] as string[],
});
