/* eslint-disable @typescript-eslint/no-explicit-any */
import type { QuoteInput } from "./schemas";
import { computeTotals, supplyType, type QuoteLine } from "./quoteCalc";

export const snapCompany = (c: any) => ({
  name: c.name, tagline: c.tagline, addressLines: c.addressLines, state: c.state, stateCode: c.stateCode, gstin: c.gstin,
  phone: c.phone, mobile: c.mobile, website: c.website, email: c.email, bank: c.bank, quotePrefix: c.quotePrefix,
});
export const snapCustomer = (c: any, contact: { name: string; phone: string }) => ({
  name: c.name, addressLines: c.addressLines, pincode: c.pincode, gstin: c.gstin, state: c.state, stateCode: c.stateCode, contact,
});

/** fields derived from user input; totals are always recomputed here, never trusted from the client */
export function derive(input: QuoteInput, companySnap: any, customerSnap: any) {
  const date = new Date(input.date + "T12:00:00Z");
  const validUntil = new Date(date.getTime() + input.validityDays * 86400000);
  const supply = input.taxType === "intra" || input.taxType === "inter" ? input.taxType : supplyType(companySnap?.stateCode, customerSnap?.stateCode);
  const totals = computeTotals(input.lines as QuoteLine[], input.gstRate, supply);
  return {
    date, validUntil, validityDays: input.validityDays, referredBy: input.referredBy,
    priceListId: input.priceListId || undefined, gstRate: input.gstRate, taxType: input.taxType,
    lines: input.lines, terms: input.terms.filter((t) => t.label.trim() || t.value.trim()),
    image: input.image || undefined, imageCaption: input.imageCaption, images: input.images, totals,
  };
}
