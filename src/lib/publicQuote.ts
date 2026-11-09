/* eslint-disable @typescript-eslint/no-explicit-any */
import { Quote } from "@/models/Quote";
import { dbConnect } from "./db";

/** quote for the public link: only if the link is live; internal data (costing, cost price, price refs) removed */
export async function findShared(token: string, countView = false) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  await dbConnect();
  const q: any = await Quote.findOne({ shareToken: token });
  if (!q || (q.shareExpiresAt && q.shareExpiresAt < new Date())) return null;
  if (countView) { q.shareViews = (q.shareViews ?? 0) + 1; q.shareLastViewedAt = new Date(); await q.save(); }
  return q;
}
export function scrub(q: any) {
  const o = q.toObject ? q.toObject() : { ...q };
  o.lines = (o.lines ?? []).map(({ bom, costing, costPrice, priceRef, agreement, ...l }: any) => l);
  for (const k of ["shareToken", "createdBy", "createdByName", "priceListId", "customerId", "__v"]) delete o[k];
  o._id = String(o._id);
  return JSON.parse(JSON.stringify(o));
}
