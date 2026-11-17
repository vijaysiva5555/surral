/* eslint-disable @typescript-eslint/no-explicit-any */
/* Inward entries and outward invoices: validating one, and posting its lines into the stock ledger.
   The stock moves on the document's date (the invoice date). Two kinds of line are kept on the document but do
   not touch stock: lines without a part number, and outward lines for a part that is not on the stock ledger
   (items bought and sold directly, never stocked). Goods received for an unknown part put it on the ledger. */
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { z } from "zod";
import { audit, type AuditChange } from "./audit";
import { assertNoNegative, ensureItems, masterDescs, refreshBalances } from "./stock";
import { dayLabel, fyOf, isDay, isQty, normPn, qtyText, r2, type Move } from "./stockCalc";
import { StockDoc, StockItem, StockMove } from "@/models/Stock";

export type DocType = "in" | "out";
export const DOC = {
  in: { entity: "stockInward", name: "Inward entry", party: "Supplier", path: "/stock/inward" },
  out: { entity: "stockOutward", name: "Outward invoice", party: "Customer", path: "/stock/outward" },
} as const;
export const parseDocType = (s: unknown): DocType | null => (s === "in" || s === "out" ? s : null);

const line = z.object({
  pn: z.string().trim().max(60).default("").transform(normPn),
  desc: z.string().trim().max(300).default(""),
  qty: z.coerce.number({ invalid_type_error: "Enter the quantity" }).refine((n) => isQty(n) && n > 0, "Quantity must be more than 0, with at most two decimals"),
  remarks: z.string().trim().max(200).default(""),
});
export const docSchema = z.object({
  type: z.enum(["in", "out"]),
  no: z.string().trim().min(1, "Enter the invoice number").max(60),
  date: z.string().refine(isDay, "Choose the invoice date"),
  party: z.string().trim().max(200).default(""),
  customerId: z.string().regex(/^[a-f0-9]{24}$/i).nullish(),
  remarks: z.string().trim().max(500).default(""),
  lines: z.array(z.any()).transform((a) => a.filter((l) => l && (String(l.pn ?? "").trim() || String(l.desc ?? "").trim() || l.qty))).pipe(z.array(line).min(1, "Add at least one item"))
    .refine((a) => a.every((l) => l.pn || l.desc), "Every item needs a part number or a description"),
});
export type DocInput = z.infer<typeof docSchema>;

/** the stock movements a document makes; an inward entry first puts unknown parts on the ledger */
async function movesOf(d: { type: DocType; date: string; lines: { pn: string; desc?: string; qty: number }[] }): Promise<Move[]> {
  const lines = d.lines.filter((l) => l.pn);
  if (d.type === "in") { await ensureItems(lines, d.date); return lines.map((l) => ({ pn: l.pn, date: d.date, dir: "in" as const, qty: r2(l.qty) })); }
  const stocked = new Set((await StockItem.find({ pn: { $in: lines.map((l) => l.pn) } }).select("pn").lean<any[]>()).map((i) => i.pn));
  return lines.filter((l) => stocked.has(l.pn)).map((l) => ({ pn: l.pn, date: d.date, dir: "out" as const, qty: r2(l.qty) }));
}
/** An item saved with a part number but no description gets one: from the Parts master, else from the stock ledger.
    (The form fills it in while typing; this covers a save pressed before that answer arrived.) */
async function fillDescs(d: DocInput) {
  const blank = d.lines.filter((l) => l.pn && !l.desc);
  if (blank.length === 0) return;
  const pns = blank.map((l) => l.pn);
  const [master, ledger] = await Promise.all([masterDescs(pns), StockItem.find({ pn: { $in: pns } }).select("pn desc").lean<any[]>()]);
  const own = new Map(ledger.map((i) => [i.pn as string, String(i.desc ?? "").trim()]));
  for (const l of blank) l.desc = master.get(l.pn) || own.get(l.pn) || "";
}
const title = (d: { type: DocType; no: string }) => `${DOC[d.type].name} ${d.no}`;

/** an outward invoice number may be used once per financial year */
async function assertUniqueNo(d: DocInput, exceptId?: string) {
  if (d.type !== "out") return;
  const fy = fyOf(d.date).label;
  const dup = await StockDoc.findOne({ type: "out", fy, no: new RegExp(`^${d.no.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).select("date party").lean<any>();
  if (dup) throw NextResponse.json({ error: `Invoice no. ${d.no} already exists in ${fy} (${dayLabel(dup.date)}${dup.party ? `, ${dup.party}` : ""}).` }, { status: 409 });
}

const fields = (d: DocInput, session: Session) => ({
  type: d.type, no: d.no, date: d.date, fy: fyOf(d.date).label, party: d.party, customerId: d.customerId || undefined, remarks: d.remarks,
  lines: d.lines.map((l) => ({ ...l, qty: r2(l.qty) })), qtyTotal: r2(d.lines.reduce((s, l) => s + l.qty, 0)), updatedByName: session.user.name ?? "",
});

export async function createDoc(session: Session, d: DocInput) {
  await assertUniqueNo(d);
  await fillDescs(d);
  const add = await movesOf(d), pns = add.map((m) => m.pn);
  if (d.type === "out") await assertNoNegative(pns, { add });
  const doc = await StockDoc.create({ ...fields(d, session), createdBy: session.user.id, createdByName: session.user.name ?? "" });
  if (add.length) await StockMove.insertMany(add.map((m) => ({ ...m, src: "doc", docId: doc._id })));
  await refreshBalances(pns, title(d));
  await audit(session, "create", DOC[d.type].entity, String(doc._id), `${title(d)} · ${dayLabel(d.date)}${d.party ? ` · ${d.party}` : ""} · ${d.lines.length} item${d.lines.length === 1 ? "" : "s"}, qty ${qtyText(doc.qtyTotal)}`,
    d.lines.map((l, i) => ({ field: `Line ${i + 1} · ${l.pn || l.desc}`, to: `Qty ${qtyText(l.qty)}` })));
  return doc;
}

export async function updateDoc(session: Session, id: string, d: DocInput) {
  const old = await StockDoc.findById(id).lean<any>();
  if (!old) throw NextResponse.json({ error: "Not found" }, { status: 404 });
  if (old.type !== d.type) throw NextResponse.json({ error: "An inward entry cannot be turned into an outward invoice." }, { status: 400 });
  await assertUniqueNo(d, id);
  await fillDescs(d);
  const add = await movesOf(d), pns = [...new Set([...add.map((m) => m.pn), ...(old.lines ?? []).map((l: any) => l.pn).filter(Boolean)])];
  // replacing the old lines by the new ones is checked as one change, so moving a quantity between days or parts is allowed when the result is valid
  await assertNoNegative(pns, { remove: (m) => String(m.docId ?? "") === id, add });
  const doc = await StockDoc.findByIdAndUpdate(id, { $set: fields(d, session), ...(d.customerId ? {} : { $unset: { customerId: "" } }) }, { new: true });
  await StockMove.deleteMany({ docId: id });
  if (add.length) await StockMove.insertMany(add.map((m) => ({ ...m, src: "doc", docId: id })));
  await refreshBalances(pns, title(d));
  const changes = docChanges(old, d);
  if (changes.length) await audit(session, "update", DOC[d.type].entity, id, `Edited ${title(d).toLowerCase()} (${changes.length} change${changes.length === 1 ? "" : "s"})`, changes);
  return doc;
}

export async function deleteDoc(session: Session, id: string) {
  const old = await StockDoc.findById(id).lean<any>();
  if (!old) throw NextResponse.json({ error: "Not found" }, { status: 404 });
  const pns = [...new Set<string>((old.lines ?? []).map((l: any) => l.pn).filter(Boolean))];
  // taking back an inward entry removes stock that may already have gone out
  await assertNoNegative(pns, { remove: (m) => String(m.docId ?? "") === id });
  await StockMove.deleteMany({ docId: id });
  await StockDoc.deleteOne({ _id: id });
  await refreshBalances(pns, `${title(old)} deleted`);
  await audit(session, "delete", DOC[old.type as DocType].entity, id, `Deleted ${title(old).toLowerCase()} · ${dayLabel(old.date)}${old.party ? ` · ${old.party}` : ""} · qty ${qtyText(old.qtyTotal ?? 0)}`,
    (old.lines ?? []).map((l: any, i: number) => ({ field: `Line ${i + 1} · ${l.pn || l.desc}`, from: `Qty ${qtyText(l.qty)}` })));
}

/** what an edit changed, for the audit log: header fields, then lines added / removed / changed (matched by part number + description) */
export function docChanges(old: any, d: DocInput): AuditChange[] {
  const out: AuditChange[] = [];
  const head: [string, string, string][] = [["Invoice no.", old.no ?? "", d.no], ["Invoice date", dayLabel(old.date), dayLabel(d.date)], [DOC[d.type].party, old.party ?? "", d.party], ["Remarks", old.remarks ?? "", d.remarks]];
  for (const [field, from, to] of head) if (from !== to) out.push({ field, from: from || "—", to: to || "—" });
  const key = (l: any) => `${l.pn}|${l.desc}`.toLowerCase();
  const left = new Map<string, any[]>();
  for (const l of old.lines ?? []) (left.get(key(l)) ?? left.set(key(l), []).get(key(l))!).push(l);
  for (const l of d.lines) {
    const was = left.get(key(l))?.shift();
    const name = l.pn || l.desc;
    if (!was) out.push({ field: `Line added · ${name}`, to: `Qty ${qtyText(l.qty)}` });
    else {
      if (r2(was.qty) !== r2(l.qty)) out.push({ field: `${name} · Qty`, from: qtyText(was.qty), to: qtyText(l.qty) });
      if ((was.remarks ?? "") !== l.remarks) out.push({ field: `${name} · Remarks`, from: was.remarks || "—", to: l.remarks || "—" });
    }
  }
  for (const rest of left.values()) for (const l of rest) out.push({ field: `Line removed · ${l.pn || l.desc}`, from: `Qty ${qtyText(l.qty)}` });
  return out;
}
