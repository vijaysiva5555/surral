/* eslint-disable @typescript-eslint/no-explicit-any */
import { CustomerAgreement } from "@/models/CustomerAgreement";
import { Customer } from "@/models/Customer";

export type Resolved = { fixedPrice?: number; discountPct?: number; note: string; source: "part" | "all" | "standard" };

/** For each part number: its own agreement, else the customer's "all parts" agreement, else the customer's standard discount */
export async function resolveAgreements(customerId: string, pns: string[], date: Date): Promise<{ standardDiscountPct: number; matches: Record<string, Resolved> }> {
  const [cust, rows] = await Promise.all([
    Customer.findById(customerId).select("standardDiscountPct").lean<any>(),
    CustomerAgreement.find({ customerId, pn: { $in: [...pns.map((p) => p.toUpperCase()), "*"] } }).lean<any[]>(),
  ]);
  const live = rows.filter((r) => (!r.validFrom || r.validFrom <= date) && (!r.validTo || r.validTo >= date));
  const matches: Record<string, Resolved> = {};
  for (const pn of pns) {
    const up = pn.toUpperCase();
    const a = live.find((r) => r.pn === up) ?? live.find((r) => r.pn === "*");
    if (a) matches[pn] = { fixedPrice: a.fixedPrice ?? undefined, discountPct: a.discountPct ?? undefined, note: a.note || (a.pn === "*" ? "Customer discount agreement" : "Customer price agreement"), source: a.pn === "*" ? "all" : "part" };
    else if (cust?.standardDiscountPct) matches[pn] = { discountPct: cust.standardDiscountPct, note: "Customer standard discount", source: "standard" };
  }
  return { standardDiscountPct: cust?.standardDiscountPct ?? 0, matches };
}
