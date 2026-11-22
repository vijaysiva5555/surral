import { z } from "zod";
import { amountInWords, r2 } from "./quoteCalc";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProjectContact = { name: string; phone: string };

export const MAX_OFFER_IMAGES = 6;
export const MAX_TECHNICALS = 15;
const OFFER_IMAGE_KEY = /^[\w-]+\/offers\/\d{4}\/[0-9a-f-]{36}\.(jpg|png)$/;
const imageKey = z.string().regex(OFFER_IMAGE_KEY, "Only uploaded images can be attached");
/** every S3 key a project quotation references – offer photos, technical-description photos and the cover photo
    (for clean-up when images are removed or the quotation is deleted) */
export const offerImageKeys = (offers: any[] | undefined, q?: { technicals?: any[] | null; coverImage?: string | null }): string[] => [
  ...(offers ?? []).flatMap((o) => o?.images ?? []),
  ...(q?.technicals ?? []).map((t) => t?.image).filter(Boolean),
  ...(q?.coverImage ? [q.coverImage] : []),
];

export const projectLineSchema = z.object({
  description: z.string().trim().default(""),
  qty: z.string().trim().default("1"),
  unitPrice: z.coerce.number().min(0).default(0),
});
export const projectConsistSchema = z.object({
  description: z.string().trim().default(""),
  qty: z.string().trim().default(""),
});
const specRow = z.object({ label: z.string().trim().default(""), value: z.string().trim().default("") });
export const projectOfferSchema = z.object({
  title: z.string().trim().default(""),
  items: z.array(projectLineSchema).default([]),
  /** "Graco Supply Consists of" */
  consists: z.array(projectConsistSchema).default([]),
  /** "Surral Supply Consists of" – numbered on from the Graco list */
  surralConsists: z.array(projectConsistSchema).default([]).transform((a) => a.filter((c) => c.description || c.qty)),
  /** photos of the offered equipment – S3 keys from /api/uploads (surral/offers/<yyyy>/<uuid>.jpg) */
  images: z.array(imageKey).max(MAX_OFFER_IMAGES, `Up to ${MAX_OFFER_IMAGES} images per offer`).default([]),
});
export const technicalSchema = z.object({
  title: z.string().trim().default(""),
  specs: z.array(specRow).default([]).transform((a) => a.filter((s) => s.label || s.value)),
  image: imageKey.nullish().transform((v) => v || null),
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
  /** the system offered, printed on the cover page ("… Installation and Commissioning of <systemName>") */
  systemName: z.string().trim().max(160).default(""),
  /** cover-page photo (S3 key) */
  coverImage: imageKey.nullish().transform((v) => v || null),
  equipmentGraco: z.array(z.string()).default([]).transform((a) => a.map((s) => s.trim()).filter(Boolean)),
  equipmentSurral: z.array(z.string()).default([]).transform((a) => a.map((s) => s.trim()).filter(Boolean)),
  technicalTitle: z.string().trim().default(""),
  specs: z.array(specRow).default([]).transform((a) => a.filter((s) => s.label || s.value)),
  /** one "TECHNICAL DESCRIPTION" block per item: title, specification table and a photo beside it */
  technicals: z.array(technicalSchema).max(MAX_TECHNICALS, `Up to ${MAX_TECHNICALS} technical descriptions`).default([])
    .transform((a) => a.filter((t) => t.title || t.specs.length || t.image)),
  offers: z.array(projectOfferSchema).default([]),
  /** further lines of the OFFER TOTAL table after the offers (installation, freight …) */
  extras: z.array(projectLineSchema).default([]).transform((a) => a.filter((l) => l.description)),
  exclusions: z.array(z.string()).default([]).transform((a) => a.map((s) => s.trim()).filter(Boolean)),
  terms: z.array(z.object({ label: z.string().trim().default(""), value: z.string().default("") }))
    .default([]).transform((a) => a.filter((t) => t.label || t.value)),
});
export type ProjectQuoteInput = z.infer<typeof projectQuoteInputSchema>;

export const qtyNum = (q: string) => {
  const n = parseFloat(String(q).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 1;
};
export const lineAmount = (l: any) => qtyNum(l.qty) * (Number(l.unitPrice) || 0);

/** offer totals are always recomputed from the lines (the offers, then extra lines such as installation and freight), never trusted from the client */
export function projectTotals(offers: any[], gstNote: string, extras: any[] = []) {
  const sum = (ls: any[]) => (ls ?? []).reduce((s: number, l: any) => s + lineAmount(l), 0);
  const total = r2((offers ?? []).reduce((t, o) => t + sum(o.items), 0) + sum(extras));
  return { total, words: amountInWords(total), gstNote };
}
/** the GST note printed under the total: the "Taxes" term when there is one */
export const gstNoteOf = (terms: { label: string; value: string }[]) => terms.find((t) => /tax/i.test(t.label))?.value || "GST 18% Extra";

/** the technical descriptions of a quotation; older quotations kept a single title + spec table */
export const technicalsOf = (q: any): { title: string; specs: { label: string; value: string }[]; image?: string | null }[] =>
  (q?.technicals ?? []).length ? q.technicals
    : q?.technicalTitle || (q?.specs ?? []).length ? [{ title: q.technicalTitle ?? "", specs: q.specs ?? [], image: null }] : [];

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

/** terms printed as lines under the TERMS & CONDITIONS heading (with the order address); every other term gets its own heading */
export const INLINE_TERMS = /^(taxes?|other)$/i;
/** a term that starts on a new page of its own */
export const PAGE_TERMS = /^warranty$/i;

const WARRANTY_TEXT = [
  "THIS WARRANTY IS EXCLUSIVE, AND IS IN LIEU OF ANY OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTY OF MERCHANTABILITY OR WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE.",
  "Graco’s sole obligation and buyer’s sole remedy for any breach of warranty shall be as set forth above. The buyer agrees that no other remedy (including, but not limited to, incidental or consequential damages for lost profits, lost sales, injury to person or property, or any other incidental or consequential loss) shall be available. Any action for breach of warranty must be brought within 18 Months of the date of sale. 12 Months from the date of Installation",
  "The warranty shall cover Graco Inc made parts, sub-assemblies and machines installed and operating in accordance with the conditions stipulated by Graco Inc., for normal use, against any material or construction defect which it shall be our responsibility to ascertain and to appraise.",
  "The warranty claim will be accepted only after the receipt of the full payment of the order value.",
  "The following shall be excluded from the warranty:",
  "• Wearing parts, even if not listed in the notices or manuals;",
  "• Normal wear and tear of sub-assemblies or the machine;",
  "• Deterioration or wear and tear arising from abnormal or excessive use not provided for by Graco Inc, and that arising from lack of maintenance or negligence;",
  "• Deterioration or wear and tear arising from the application of abrasive or corrosive products, and that caused by chemical products and electrochemical reactions",
  "• Use or application different from that defined in advance, and the use of products different from those defined in advance;",
  "• Setting-up and putting into service which do not comply with our recommendations, good practice or regulations in force;",
  "• Failure to comply with proper operating instructions; Transformation and/or fitting of foreign elements / non genuine parts, carried out without our agreement and/or the consequences thereof;",
  "• Designs which are not clearly explained;",
  "• Designs demanded by the customer;",
  "• Malfunction due to deviation of the intended use of the product;",
  "• Results of application to the support and its consequences;",
  "• Various forms of pollution & Accidents",
  "• The Graco’s Standards Warranty Will Not Cover for Wear & Tear Parts.",
  "The warranty shall be limited to exchange of parts returned to our factory, accompanied by the Graco Inc., document, duly filled in, for parts acknowledged as faulty by our technical department. Carriage and packing costs of the exchange parts shall be for the customer's account.",
  "Any costs generated by a halt in operations, loss of production, damage, miscellaneous repairs, accidents and or any other prejudice shall not, under any circumstances, be charged to Graco Inc.",
].join("\n");

/** The term blocks printed on every project offer — editable per quotation, as in the company's own project offer.
    "Taxes" and "Other" print as lines under the TERMS & CONDITIONS heading; every other block gets its own heading.
    Each line of a block is a point; a line starting with "•" is a sub-point of the line above. "Warranty" starts on a new page. */
export const DEFAULT_PROJECT_TERMS = (): { label: string; value: string }[] => [
  { label: "Taxes", value: "GST 18% extra." },
  { label: "Other", value: "Local Transportation, Insurance, Tax or any other levies which is not mentioned in above will be at customer’s account" },
  { label: "Payment Conditions", value: "50% advance along with Purchase Order, 40% with 100% Taxes & Duties Against Proforma Invoice, 10% Against Installation & Commissioning." },
  { label: "Delivery Time", value: "12 – 14 weeks from the date of your PO." },
  { label: "Transportation / Freight", value: "Packing & Freight: Extra as above mentioned" },
  { label: "Validity of the Quotation", value: "Offer Validity 30 Days. To extend the validity of this quotation, contact us." },
  { label: "Site Installation", value: "As per request from Customer. Please give us at least 7 days’ notice of Site Readiness, Erection & Commissioning will be completed within 2 weeks" },
  { label: "Jurisdiction", value: "Chennai" },
  { label: "Confidentiality", value: "All the technical and commercial information enclosed in this offer is confidential and cannot be communicated to any third party without Surral Surface Coatings Pvt Ltd written agreement." },
  { label: "Force Majeure", value: "Our offer is subject to the force majeure clause and as such we will not be responsible for delay in the delivery of equipment due to war, emergency, revolution, accidental fire, floods or any such natural calamities which are beyond our control." },
  { label: "Warranty", value: WARRANTY_TEXT },
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
  surralConsists: [] as { description: string; qty: string }[],
  images: [] as string[],
});
