// GST state codes (first two digits of a GSTIN)
export const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** "GST: 33aac... " -> "33AAC..." */
export function cleanGstin(raw: unknown): string {
  return String(raw ?? "").replace(/GST(IN)?\s*(No\.?)?\s*:?/i, "").replace(/\s+/g, "").toUpperCase();
}

export function stateFromGstin(gstin: string): { stateCode: string; state: string } {
  const code = gstin.slice(0, 2);
  return { stateCode: GST_STATES[code] ? code : "", state: GST_STATES[code] ?? "" };
}

/** "Mobile:+91-99443 60829" -> "9944360829" (last 10 digits) */
export function cleanPhone(raw: unknown): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

/** "Name: Chandan Prakash" / "Mr.P.V. Vignesh" -> tidy person name */
export function cleanPerson(raw: unknown): string {
  return String(raw ?? "")
    .replace(/^\s*name\s*:\s*/i, "")
    .replace(/^\s*(Mr|Ms|Mrs|Dr)\.?\s*/i, (_, t: string) => `${t[0].toUpperCase()}${t.slice(1).toLowerCase()}. `)
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanCompany(raw: unknown): string {
  return String(raw ?? "").replace(/^\s*M\/s\.?\s*/i, "").replace(/\s+/g, " ").trim();
}

export function findPincode(text: string): string {
  const m = [...text.matchAll(/\b(\d{3})\s?(\d{3})\b/g)];
  return m.length ? m[m.length - 1][1] + m[m.length - 1][2] : "";
}
