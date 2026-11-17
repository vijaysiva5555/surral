/* eslint-disable @typescript-eslint/no-explicit-any */
/* The customer list and its Excel export take the same filters: free text (q) and a GST state (state). */

/** state value for customers that have no GST number, and so no state */
export const NO_STATE = "none";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** q matches the company name, GST number, address or pincode; state is a two-digit GST state code or NO_STATE */
export function customerFilter(q?: string | null, state?: string | null): Record<string, any> {
  const and: Record<string, any>[] = [];
  const text = q?.trim();
  if (text) { const re = new RegExp(esc(text), "i"); and.push({ $or: [{ name: re }, { gstin: re }, { addressLines: re }, { pincode: re }] }); }
  const st = state?.trim();
  if (st === NO_STATE) and.push({ $or: [{ stateCode: { $exists: false } }, { stateCode: null }, { stateCode: "" }] });
  else if (st && /^\d{2}$/.test(st)) and.push({ stateCode: st });
  return and.length ? { $and: and } : {};
}
