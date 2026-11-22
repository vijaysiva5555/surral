/* eslint-disable @typescript-eslint/no-explicit-any */
/* Turns a record's "before" and "after" into the readable change list stored on an audit entry (src/lib/audit.ts).
   Pure: no database access. Values come out formatted for people; secrets and bulky blobs never come out at all. */
import type { AuditChange } from "./audit";
import { dmy } from "./format";
import { quoteStatusLabel } from "./quoteStatus";
import { ROLE_LABEL } from "./roles";

type Row = Record<string, any>;
type RowSpec = {
  noun: string;                              // "Line", "Item", "Contact"…
  keys: ((r: Row) => unknown[])[];           // how to recognise the same row after an edit, most reliable first
  ident: (r: Row) => unknown;                // short name shown in the label: Line 2 (24N634)
  summary: (r: Row) => string;               // one line for an added / removed row
};
type Ctx = { out: AuditChange[]; count: number; only?: string[]; ignore?: string[] };

export const MAX_CHANGES = 80;
const MAX_VALUE = 200, MAX_FIELD = 120, EMPTY = "—";

/** never recorded, at any depth */
const SECRET = /pass(word|wd)?|hash|token|secret/i;
/** bookkeeping and id-only references (the name is recorded instead) */
const NOISE = new Set(["_id", "__v", "id", "createdAt", "updatedAt", "createdBy", "createdByName", "customerId", "priceListId", "bomId",
  "shareViews", "shareLastViewedAt", "shareExpiresAt", "stockAlertsSeenAt"]);
/** derived from other fields that are already reported */
const IGNORE_PATH = ["totals.words", "totals.supply", "totals.gstRate", "totals.cgst", "totals.sgst", "totals.igst", "totals.roundOff", "totals.gstNote"];
const IMAGE = new Set(["image", "logoData", "partnerLogoData"]);   // data URLs or file keys: only "changed" is recorded
const FILE_LIST = new Set(["images"]);                             // lists of uploaded file keys: only the count is recorded

const LABEL: Record<string, string> = {
  name: "Name", addressLines: "Address", pincode: "Pincode", gstin: "GST no.", state: "State", stateCode: "State code", contacts: "Contacts", contact: "Contact",
  standardDiscountPct: "Standard discount %", active: "Active", phone: "Phone", mobile: "Mobile", email: "E-mail", designation: "Designation", website: "Website", tagline: "Tagline",
  customer: "Customer", company: "Company", number: "Number", revision: "Revision", category: "Section", date: "Date", validityDays: "Valid for (days)", validUntil: "Valid until",
  referredBy: "Referred by", followedBy: "Followed person", followedByPhone: "Followed person ph. number", status: "Status", gstRate: "GST %", taxType: "GST type", image: "Product image", imageCaption: "Image caption", images: "Photos", totals: "Totals",
  lines: "Lines", kind: "Type", code: "Code", description: "Description", desc: "Description", hsn: "HSN", qty: "Qty", uom: "Unit", basicPrice: "Basic price", discountPct: "Discount %",
  subItems: "Sub-items", costPrice: "Cost price", agreement: "Price agreement", priceRef: "List price reference", bom: "BOM", costing: "Costing",
  items: "Items", make: "Make", listPrice: "List price", landed: "Landed cost", marginPct: "Margin %", margin2Pct: "Margin 2 %", unitPrice: "Unit price",
  subject: "Subject", intro: "Introduction", preparedBy: "Prepared by", approvedBy: "Approved by", signerName: "Signed by", signerPhone: "Signer phone", signerEmail: "Signer e-mail",
  equipmentGraco: "Graco equipment", equipmentSurral: "Surral equipment", technicalTitle: "Technical title", technicals: "Technical descriptions", systemName: "System name (cover)", coverImage: "Cover photo", extras: "Offer total lines", surralConsists: "Surral supply consists of", specs: "Specifications", offers: "Offers", consists: "Consists of",
  exclusions: "Exclusions", terms: "Terms", title: "Title", label: "Label", value: "Text", isDefault: "Default template", role: "Role",
  quotePrefix: "Spare quotation prefix", quoteStartNo: "Spare quotation start no.", equipmentQuotePrefix: "Equipment quotation prefix", equipmentQuoteStartNo: "Equipment quotation start no.",
  projectPrefix: "Project offer prefix", projectStartNo: "Project offer start no.", logoData: "Logo", partnerLogoData: "Partner logo", bank: "Bank", branch: "Branch", accountNo: "Account no.", ifsc: "IFSC",
  pn: "Part no.", pga: "PGA", division: "Division", application: "Application", discountCode: "Discount code", sbu: "SBU", familyCode: "Family code", itemStatus: "Item status", recordType: "Record type",
  partnerDiscountPct: "Partner discount %", partnerNetPrice: "Partner net price", fixedPrice: "Fixed price", validFrom: "Valid from", validTo: "Valid to", note: "Note", total: "Total", subtotal: "Subtotal",
};
/** whole labels for a few nested fields that read badly when built from their parts */
const PATH_LABEL: Record<string, string> = {
  "customer.name": "Customer", "customer.contact.name": "Customer contact · Name", "customer.contact.phone": "Customer contact · Phone",
  "totals.total": "Total", "totals.subtotal": "Subtotal", "preparedBy.name": "Prepared by", "preparedBy.phone": "Prepared by · Phone",
};
const VALUE: Record<string, (v: string) => string> = {
  status: quoteStatusLabel,
  role: (v) => (ROLE_LABEL as Record<string, string>)[v] ?? v,
  taxType: (v) => ({ auto: "Auto (by state)", intra: "Within state (CGST + SGST)", inter: "Other state (IGST)" } as Record<string, string>)[v] ?? v,
  category: (v) => ({ spare: "Spare", equipment: "Equipment" } as Record<string, string>)[v] ?? v,
  kind: (v) => ({ part: "Part", package: "Package", custom: "Custom" } as Record<string, string>)[v] ?? v,
};

const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const isEmpty = (v: unknown): boolean =>
  v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.every(isEmpty)) || (isObj(v) && Object.values(v).every(isEmpty));
const isBlob = (v: unknown) => typeof v === "string" && (v.startsWith("data:") || (v.length > 1000 && !/\s/.test(v.slice(0, 300))));
const skipKey = (k: string) => NOISE.has(k) || SECRET.test(k);
const clip = (s: string, n = MAX_VALUE) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, ISO_DAY = /^\d{4}-\d{2}-\d{2}$/, DATE_KEY = /date|valid(From|To|Until)|At$/i;

function leafLabel(k: string) {
  if (LABEL[k]) return LABEL[k];
  const s = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase().replace(/ pct$/, " %").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** one value as people read it: dates dd.mm.yyyy, Yes / No, plain numbers, "—" when empty */
function fmt(v: unknown, key = ""): string {
  if (isEmpty(v)) return EMPTY;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? String(Number(v.toFixed(4))) : EMPTY;
  if (v instanceof Date) return dmy(v);
  if (typeof v === "string") {
    if (isBlob(v)) return v.startsWith("data:image") ? "image" : "(data)";
    if (ISO_TIME.test(v) || (ISO_DAY.test(v) && DATE_KEY.test(key))) return dmy(v);
    return clip((VALUE[key]?.(v) ?? v).replace(/\s+/g, " ").trim());
  }
  if (Array.isArray(v)) return clip(v.filter((x) => !isEmpty(x)).map((x) => fmt(x, key)).join(", "));
  if (isObj(v)) return clip(Object.entries(v).filter(([k, x]) => !skipKey(k) && !isEmpty(x)).map(([k, x]) => `${leafLabel(k)}: ${fmt(x, k)}`).join(", "));
  return clip(String(v));
}

/** equal for audit purposes: empty values (and 0 against nothing) are the same, bookkeeping keys are not looked at */
function eq(x: unknown, y: unknown): boolean {
  const ex = isEmpty(x), ey = isEmpty(y);
  if (ex || ey) return (ex && ey) || (ex && y === 0) || (ey && x === 0);
  if (typeof x === "number" && typeof y === "number") return Math.abs(x - y) < 1e-9;
  if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => eq(v, y[i]));
  if (isObj(x) && isObj(y)) return [...new Set([...Object.keys(x), ...Object.keys(y)])].every((k) => skipKey(k) || eq(x[k], y[k]));
  if (typeof x !== typeof y) return String(x) === String(y);
  return x === y;
}

const first = (r: Row, ...ks: string[]) => ks.map((k) => r?.[k]).find((v) => !isEmpty(v));
const NAME_KEYS = ["code", "pn", "partNo", "name", "label", "title", "description", "desc"];
const genericRows = (label: string): RowSpec => ({
  noun: label.split(" · ").pop()!.replace(/s$/, "") || "Row",
  keys: [(r) => [first(r, ...NAME_KEYS)]], ident: (r) => first(r, ...NAME_KEYS), summary: (r) => fmt(r),
});
const joinParts = (...p: unknown[]) => p.filter((v) => !isEmpty(v)).map((v) => String(v).trim()).join(" – ");
const labelValue: Omit<RowSpec, "noun"> = { keys: [(r) => [r.label], (r) => [r.value]], ident: (r) => r.label, summary: (r) => joinParts(r.label, r.value) };
const ROWS: Record<string, RowSpec> = {
  lines: {
    noun: "Line", keys: [(r) => [r.id], (r) => [r.code, r.description], (r) => [r.code], (r) => [r.description]], ident: (r) => r.code || r.description,
    summary: (r) => `${joinParts(r.code, r.description)}, qty ${fmt(r.qty)}${r.uom ? ` ${r.uom}` : ""} @ ${fmt(r.basicPrice)}${r.discountPct ? ` less ${fmt(r.discountPct)}%` : ""}`,
  },
  items: {   // BOM items and project-offer items
    noun: "Item", keys: [(r) => [r.make, r.description], (r) => [r.description]], ident: (r) => r.description || r.make,
    summary: (r) => `${joinParts(r.make, r.description)}, qty ${fmt(r.qty)}${r.unitPrice != null ? ` @ ${fmt(r.unitPrice)}` : r.landed ? `, landed ${fmt(r.landed)}` : r.listPrice ? `, list ${fmt(r.listPrice)}` : ""}`,
  },
  contacts: { noun: "Contact", keys: [(r) => [r.name], (r) => [r.phone], (r) => [r.email]], ident: (r) => r.name || r.phone || r.email, summary: (r) => [r.name, r.designation, r.phone, r.email].filter((v) => !isEmpty(v)).join(", ") },
  terms: { noun: "Term", ...labelValue },
  specs: { noun: "Spec", ...labelValue },
  offers: { noun: "Offer", keys: [(r) => [r.title]], ident: (r) => r.title, summary: (r) => `${r.title || "Offer"} (${plural((r.items ?? []).length, "item")})` },
  consists: { noun: "Component", keys: [(r) => [r.description]], ident: (r) => r.description, summary: (r) => joinParts(r.description, r.qty) },
};
/** nested snapshots that are summarised in one line instead of being walked field by field */
const SUMMARY: Record<string, (v: any) => string> = {
  bom: (v) => `${v?.name || "BOM"} (${plural((v?.items ?? []).length, "item")})`,
  costing: () => "costing sheet",
  priceRef: (v) => `${v?.pn ?? ""}${v?.pga ? ` / ${v.pga}` : ""}, ${v?.year ?? ""}: ${fmt(v?.listPrice)}`,
};

function put(c: Ctx, field: string, from?: string, to?: string) {
  c.count++;
  if (c.out.length >= MAX_CHANGES) return;
  const e: AuditChange = { field: clip(field, MAX_FIELD) };
  if (from !== undefined) e.from = clip(from);
  if (to !== undefined) e.to = clip(to);
  c.out.push(e);
}

const under = (p: string, root: string) => p === root || p.startsWith(root + ".");
const allowed = (c: Ctx, p: string) =>
  !IGNORE_PATH.some((i) => under(p, i)) && !c.ignore?.some((i) => under(p, i)) && (!c.only || c.only.some((o) => under(p, o) || under(o, p)));

function walk(c: Ctx, path: string, label: string, a: Row, b: Row) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (skipKey(k)) continue;
    const p = path ? `${path}.${k}` : k;
    if (!allowed(c, p)) continue;
    one(c, p, k, PATH_LABEL[p] ?? (label ? `${label} · ${leafLabel(k)}` : leafLabel(k)), label, a[k], b[k]);
  }
}

function one(c: Ctx, p: string, k: string, lbl: string, base: string, x: unknown, y: unknown) {
  if (eq(x, y)) return;
  if (IMAGE.has(k) || isBlob(x) || isBlob(y)) {
    const noun = IMAGE.has(k) || [x, y].some((v) => typeof v === "string" && v.startsWith("data:image")) ? "image" : "data";
    return put(c, lbl, isEmpty(x) ? EMPTY : noun, isEmpty(y) ? `${noun} removed` : isEmpty(x) ? `${noun} added` : `${noun} changed`);
  }
  const sum = SUMMARY[k];
  if (sum && (isObj(x) || isObj(y))) {
    const f = isEmpty(x) ? EMPTY : sum(x), t = isEmpty(y) ? EMPTY : sum(y);
    return put(c, lbl, f, f === t ? `${t} – contents changed` : t);
  }
  if (Array.isArray(x) || Array.isArray(y)) {
    const xs = toList(x), ys = toList(y);
    if (FILE_LIST.has(k)) return put(c, lbl, plural(xs.length, "image"), xs.length === ys.length ? `${plural(ys.length, "image")} (replaced)` : plural(ys.length, "image"));
    if ([...xs, ...ys].some(isObj)) return rows(c, p, base, ROWS[p] ?? ROWS[k] ?? genericRows(lbl), xs.filter(isObj), ys.filter(isObj));
    return list(c, lbl, k, xs, ys);
  }
  if (isObj(x) || isObj(y)) return walk(c, p, lbl, isObj(x) ? x : {}, isObj(y) ? y : {});
  const f = fmt(x, k), t = fmt(y, k);
  if (f !== t) put(c, lbl, f, t);
}
const toList = (v: unknown): unknown[] => (Array.isArray(v) ? v : isEmpty(v) ? [] : [v]);

/** list of plain values (address lines, exclusions…): short lists are shown whole, long ones as what was added / removed */
function list(c: Ctx, lbl: string, k: string, xs: unknown[], ys: unknown[]) {
  const a = xs.filter((v) => !isEmpty(v)).map((v) => fmt(v, k)), b = ys.filter((v) => !isEmpty(v)).map((v) => fmt(v, k));
  const ja = a.join(", "), jb = b.join(", ");
  if (ja === jb) return;
  if (ja.length <= MAX_VALUE && jb.length <= MAX_VALUE) return put(c, lbl, ja || EMPTY, jb || EMPTY);
  const left = [...b], removed = a.filter((v) => { const i = left.indexOf(v); if (i < 0) return true; left.splice(i, 1); return false; });
  removed.forEach((v) => put(c, `${lbl} · removed`, v, undefined));
  left.forEach((v) => put(c, `${lbl} · added`, undefined, v));
  if (!removed.length && !left.length) put(c, lbl, undefined, "order changed");
}

const keyOf = (parts: unknown[]) => (parts.every(isEmpty) ? "" : parts.map((v) => String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase()).join("\u0001"));
/** share of a row's fields that are unchanged, 0…1 */
function alike(x: Row, y: Row) {
  const ks = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => !skipKey(k) && !(isEmpty(x[k]) && isEmpty(y[k])));
  return ks.length ? ks.filter((k) => eq(x[k], y[k])).length / ks.length : 0;
}

/** pair[j] = index of the "before" row that became after-row j, or -1 for a new row */
function matchRows(xs: Row[], ys: Row[], spec: RowSpec): number[] {
  const pair: number[] = ys.map(() => -1), used: boolean[] = xs.map(() => false);
  const take = (i: number, j: number) => { pair[j] = i; used[i] = true; };
  for (const fn of spec.keys) {
    const pool = new Map<string, number[]>();
    xs.forEach((r, i) => { const k = used[i] ? "" : keyOf(fn(r)); if (k) pool.set(k, [...(pool.get(k) ?? []), i]); });
    ys.forEach((r, j) => {
      const q = pair[j] < 0 ? pool.get(keyOf(fn(r))) : undefined;
      if (q?.length) take(q.splice(Math.max(0, q.indexOf(j)), 1)[0], j);   // among duplicates, prefer the one that did not move
    });
  }
  // rows whose key itself was edited: pair the ones that still have most fields in common
  const li = xs.map((_, i) => i).filter((i) => !used[i]), lj = ys.map((_, j) => j).filter((j) => pair[j] < 0);
  if (li.length && lj.length && li.length * lj.length <= 40000) {
    const cand: [number, number, number][] = [];
    for (const i of li) for (const j of lj) { const s = alike(xs[i], ys[j]); if (s >= 0.5) cand.push([s, i, j]); }
    cand.sort((p, q) => q[0] - p[0] || Math.abs(p[1] - p[2]) - Math.abs(q[1] - q[2]));
    for (const [, i, j] of cand) if (!used[i] && pair[j] < 0) take(i, j);
  }
  // same number of rows: whatever is left in the same position was edited in place
  if (xs.length === ys.length) ys.forEach((_, j) => { if (pair[j] < 0 && !used[j]) take(j, j); });
  return pair;
}

function rows(c: Ctx, p: string, base: string, spec: RowSpec, xs: Row[], ys: Row[]) {
  const pair = matchRows(xs, ys, spec);
  const pre = base ? `${base} · ` : "";
  const name = (r: Row, n: number) => { const id = isEmpty(spec.ident(r)) ? "" : clip(fmt(spec.ident(r)), 32); return `${spec.noun} ${n + 1}${id ? ` (${id})` : ""}`; };
  ys.forEach((r, j) => {
    if (pair[j] < 0) put(c, `${pre}${spec.noun} added`, undefined, `${spec.noun} ${j + 1}: ${spec.summary(r)}`);
    else walk(c, p, pre + name(r, j), xs[pair[j]], r);
  });
  const kept = new Set(pair);
  xs.forEach((r, i) => { if (!kept.has(i)) put(c, `${pre}${spec.noun} removed`, `${spec.noun} ${i + 1}: ${spec.summary(r)}`, undefined); });
  const order = pair.filter((i) => i >= 0);
  if (order.some((i, n) => n > 0 && i < order[n - 1])) put(c, `${pre}${spec.noun}s`, undefined, "order changed");
}

/** Plain copy of a document (dates as ISO text, ids as strings). Take it BEFORE changing a Mongoose document you loaded. */
export const snap = (doc: unknown): any => (doc == null ? null : JSON.parse(JSON.stringify(doc)));

/** What differs between two versions of a record, as audit rows. `only` / `ignore` take field paths without indexes
    ("customer.name", "lines.qty"). Pass null as one side to list a new or deleted record's fields. Never throws. */
export function diffChanges(before: unknown, after: unknown, opts: { only?: string[]; ignore?: string[] } = {}): AuditChange[] {
  try {
    const c: Ctx = { out: [], count: 0, only: opts.only, ignore: opts.ignore };
    const a = snap(before), b = snap(after);
    walk(c, "", "", isObj(a) ? a : {}, isObj(b) ? b : {});
    if (c.count > c.out.length) c.out.push({ field: "…", to: `+${c.count - c.out.length} more changes` });
    return c.out;
  } catch (e) { console.error("audit diff failed", e); return []; }
}

/** One hand-made row for a value that does not live on the record itself (a price in another collection, a looked-up name).
    Returns [] when nothing changed, so it can be spread into a change list. */
export function change(field: string, from: unknown, to: unknown, key = ""): AuditChange[] {
  if (eq(from, to)) return [];
  const f = fmt(from, key), t = fmt(to, key);
  return f === t ? [] : [{ field: clip(field, MAX_FIELD), from: f, to: t }];
}
