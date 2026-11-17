/* eslint-disable @typescript-eslint/no-explicit-any */
/* Excel import for the stock ledger. Two kinds of file are understood:

   history – the yearly workbook with sheets "Opening stock…", "Inward", "Outward" (and "Ledger"): loads the first
             stock count and every inward / outward invoice since. Used once to start, or to replace everything.
   day     – one sheet with Location, Part no., Item Description, Op. Balance, Inward, Outward: the day sheet
             for one date, the same columns as the Ledger page.

   Parsing is pure (buffer → plan); the two apply functions write to the database. */
import ExcelJS from "exceljs";
import { StockAlert, StockDoc, StockItem, StockMove } from "@/models/Stock";
import { refreshBalances } from "./stock";
import { LOW_STOCK, dayLabel, firstNewNegative, fyOf, isDay, normPn, qtyText, r2, type Move } from "./stockCalc";

export type Issue = { sheet: string; row: number; text: string };
type PlanItem = { pn: string; desc: string; location: string; opening: number; openingDate: string };
type PlanDoc = { type: "in" | "out"; no: string; date: string; party: string; remarks: string; lines: { pn: string; desc: string; qty: number; remarks: string }[] };
export type DayRow = { row: number; pn: string; desc: string; location: string; opening: number | null; inward: number | null; outward: number | null };
export type ImportPlan =
  | { mode: "history"; items: PlanItem[]; docs: PlanDoc[]; issues: Issue[]; stats: Record<string, number | string> }
  | { mode: "day"; sheet: string; rows: DayRow[]; issues: Issue[]; stats: Record<string, number | string> };

// ---------- reading cells ----------
const raw = (v: any): any => (v == null ? null : v instanceof Date ? v : typeof v === "object" ? ("result" in v ? raw(v.result) : "richText" in v ? v.richText.map((t: any) => t.text).join("") : "text" in v ? v.text : null) : v);
const text = (v: any) => { const x = raw(v); return x == null ? "" : x instanceof Date ? x.toISOString().slice(0, 10) : String(x).trim(); };
const num = (v: any): number | null => { const x = raw(v); if (x == null || x === "") return null; const n = typeof x === "number" ? x : Number(String(x).replace(/,/g, "").trim()); return Number.isFinite(n) ? n : NaN; };
/** "06.04.2026", "6/4/2026", a real Excel date or an Excel serial number → "2026-04-06" */
function day(v: any): string | null {
  const x = raw(v);
  if (x == null || x === "") return null;
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  if (typeof x === "number") return x > 20000 && x < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(x) * 86400000).toISOString().slice(0, 10) : null;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(String(x).trim());
  if (m) { const out = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; return isDay(out) ? out : null; }
  const iso = String(x).trim().slice(0, 10);
  return isDay(iso) ? iso : null;
}

const HEAD: Record<string, RegExp> = {
  location: /^loc/i, pn: /part\s*(no|num|#)|^p\/?n\b/i, desc: /desc/i, invoice: /(invoice|inv|bill)\.?\s*(no|num|#)/i, party: /supplier|customer|vendor|party/i,
  opening: /^op\b|^opening/i, inward: /^in\s*ward/i, outward: /^out\s*ward/i, closing: /^cl\b|^closing|^current/i, qty: /^qty|^quantity/i, date: /date/i, remarks: /remark/i,
};
/** finds the header row of a sheet and which column holds each wanted field */
function header(ws: ExcelJS.Worksheet, want: string[]) {
  let best: { row: number; cols: Record<string, number> } | null = null;
  for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
    const cols: Record<string, number> = {};
    for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
      const t = text(ws.getRow(r).getCell(c).value);
      if (!t) continue;
      const key = want.find((k) => cols[k] == null && HEAD[k].test(t));
      if (key) cols[key] = c;
    }
    if (cols.pn && (!best || Object.keys(cols).length > Object.keys(best.cols).length)) best = { row: r, cols };
  }
  return best;
}

// ---------- parsing ----------
export async function parseStockWorkbook(buf: ArrayBuffer | Buffer): Promise<ImportPlan> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as any); }
  catch { throw new Error("This file could not be opened. Save it as an Excel workbook (.xlsx) and try again."); }
  const find = (re: RegExp) => wb.worksheets.find((w) => re.test(w.name));
  const sOpen = find(/opening/i), sIn = find(/^\s*inward/i), sOut = find(/^\s*outward/i), sLedger = find(/ledger/i);
  if (sOpen || sIn || sOut) return parseHistory(sOpen, sIn, sOut, sLedger);
  for (const ws of sLedger ? [sLedger, ...wb.worksheets] : wb.worksheets) {
    const h = header(ws, ["location", "pn", "desc", "opening", "inward", "outward", "closing"]);
    if (h && (h.cols.opening || h.cols.inward || h.cols.outward)) return parseDay(ws, h);
  }
  throw new Error("This file is not a stock sheet. It needs a sheet with the columns Location, Part no., Item Description, Op. Balance, Inward, Outward – or the yearly workbook with the sheets Opening stock, Inward and Outward.");
}

function parseDay(ws: ExcelJS.Worksheet, h: { row: number; cols: Record<string, number> }): ImportPlan {
  const rows: DayRow[] = [], issues: Issue[] = [], seen = new Set<string>();
  const cell = (r: number, k: string) => (h.cols[k] ? ws.getRow(r).getCell(h.cols[k]).value : null);
  for (let r = h.row + 1; r <= ws.rowCount; r++) {
    const pn = normPn(text(cell(r, "pn"))), desc = text(cell(r, "desc"));
    if (!pn) { if (desc) issues.push({ sheet: ws.name, row: r, text: `No part number (“${desc.slice(0, 40)}”) – skipped` }); continue; }
    if (seen.has(pn)) { issues.push({ sheet: ws.name, row: r, text: `${pn} appears more than once – only the first row is used` }); continue; }
    const n = { opening: num(cell(r, "opening")), inward: num(cell(r, "inward")), outward: num(cell(r, "outward")) };
    const bad = (Object.entries(n) as [string, number | null][]).find(([, v]) => v != null && (Number.isNaN(v) || v < 0));
    if (bad) { issues.push({ sheet: ws.name, row: r, text: `${pn}: ${bad[0]} is not a number that is zero or more – row skipped` }); continue; }
    seen.add(pn);
    rows.push({ row: r, pn, desc, location: text(cell(r, "location")), opening: n.opening == null ? null : r2(n.opening), inward: n.inward == null ? null : r2(n.inward), outward: n.outward == null ? null : r2(n.outward) });
  }
  return { mode: "day", sheet: ws.name, rows, issues, stats: { rows: rows.length } };
}

function parseHistory(sOpen?: ExcelJS.Worksheet, sIn?: ExcelJS.Worksheet, sOut?: ExcelJS.Worksheet, sLedger?: ExcelJS.Worksheet): ImportPlan {
  const issues: Issue[] = [], items = new Map<string, PlanItem>(), docs: PlanDoc[] = [];
  const stats: Record<string, number | string> = {};
  const say = (ws: ExcelJS.Worksheet, row: number, t: string) => issues.push({ sheet: ws.name, row, text: t });
  let openingDate = "";

  // 1. first stock count
  if (sOpen) {
    const h = header(sOpen, ["location", "pn", "desc", "qty", "date"]);
    if (!h) throw new Error(`Sheet “${sOpen.name}” has no “Part no.” column.`);
    for (let r = h.row + 1; r <= sOpen.rowCount; r++) {
      const c = (k: string) => (h.cols[k] ? sOpen.getRow(r).getCell(h.cols[k]).value : null);
      const pn = normPn(text(c("pn"))); if (!pn) continue;
      const q = num(c("qty"));
      if (q != null && Number.isNaN(q)) { say(sOpen, r, `${pn}: opening quantity is not a number – taken as 0`); }
      const d = day(c("date")); if (d && (!openingDate || d < openingDate)) openingDate = d;
      if (items.has(pn)) { say(sOpen, r, `${pn} appears more than once – quantities added together`); items.get(pn)!.opening = r2(items.get(pn)!.opening + (q || 0)); continue; }
      items.set(pn, { pn, desc: text(c("desc")), location: text(c("location")), opening: r2(q && !Number.isNaN(q) ? q : 0), openingDate: d ?? "" });
    }
  }
  stats.openingParts = items.size;

  // 2. parts that are on the ledger sheet but had no opening stock
  if (sLedger) {
    const h = header(sLedger, ["location", "pn", "desc"]);
    if (h) for (let r = h.row + 1; r <= sLedger.rowCount; r++) {
      const c = (k: string) => (h.cols[k] ? sLedger.getRow(r).getCell(h.cols[k]).value : null);
      const pn = normPn(text(c("pn"))); if (!pn) continue;
      const loc = text(c("location")), desc = text(c("desc")), have = items.get(pn);
      if (!have) items.set(pn, { pn, desc, location: loc, opening: 0, openingDate: "" });
      else { if (!have.location && loc) have.location = loc; if (!have.desc && desc) have.desc = desc; }
    }
  }
  stats.ledgerParts = items.size;

  // 3. inward / outward invoices: a row with an invoice number or a date starts a new document, the rows below it are its items
  let repaired = 0, added = 0;
  const fix = (pn: string) => { if (!pn || items.has(pn)) return pn; if (/^\d+$/.test(pn) && items.has(`0${pn}`)) { repaired++; return `0${pn}`; } return pn; };   // Excel drops a leading zero when a part number is typed as a number
  const readDocs = (ws: ExcelJS.Worksheet | undefined, type: "in" | "out") => {
    if (!ws) return;
    const h = header(ws, ["invoice", "party", "pn", "desc", "qty", "remarks", "date"]);
    if (!h || !h.cols.qty) throw new Error(`Sheet “${ws.name}” needs the columns Part no. and Qty.`);
    let cur: PlanDoc | null = null;
    for (let r = h.row + 1; r <= ws.rowCount; r++) {
      const c = (k: string) => (h.cols[k] ? ws.getRow(r).getCell(h.cols[k]).value : null);
      const no = text(c("invoice")), d = day(c("date")), party = text(c("party"));
      let pn = normPn(text(c("pn"))); const desc = text(c("desc")), q = num(c("qty")), rem = text(c("remarks"));
      if (!no && !d && !party && !pn && !desc && q == null) continue;
      if (no || d) {
        // several invoices received on one day: only the first row carries the date (and, inward, the supplier)
        if (!d && !cur) { say(ws, r, `Invoice ${no} has no date and none above it – skipped`); continue; }
        cur = { type, no, date: d ?? cur!.date, party: party || (type === "in" && !d ? cur!.party : ""), remarks: "", lines: [] };
        docs.push(cur);
      }
      if (!cur) { say(ws, r, "Item before the first invoice – skipped"); continue; }
      if (!pn && !desc && q == null) continue;
      if (/^cancel/i.test(pn) || (/cancel/i.test(desc) && !q)) { cur.remarks = [cur.remarks, "Cancelled"].filter(Boolean).join(" · "); continue; }
      if (q == null || Number.isNaN(q) || q <= 0) { say(ws, r, `${pn || desc || "Item"}: quantity ${q == null ? "is empty" : "is not a number above zero"} – item skipped`); continue; }
      pn = fix(pn);
      // goods received for a part that was never stocked put it on the ledger; goods sent out for one do not (see stockDocs.ts)
      if (pn && !items.has(pn)) { if (type === "in") { items.set(pn, { pn, desc, location: "", opening: 0, openingDate: "" }); added++; } else notStocked++; }
      cur.lines.push({ pn, desc, qty: r2(q), remarks: rem });
    }
  };
  let notStocked = 0;
  readDocs(sIn, "in"); readDocs(sOut, "out");   // inward first, so a part received and sold in the same year is on the ledger before its sale is read

  const all = docs.filter((d) => d.lines.length || d.remarks);
  const dates = all.map((d) => d.date).sort();
  if (!openingDate) openingDate = dates[0] ? fyOf(dates[0]).from : "";
  for (const i of items.values()) if (!i.openingDate) i.openingDate = openingDate;

  // the same outward invoice number twice in a year is reported; both are kept
  const seenNo = new Map<string, number>();
  for (const d of all) if (d.type === "out" && d.no) { const k = `${fyOf(d.date).label}|${d.no.toLowerCase()}`; seenNo.set(k, (seenNo.get(k) ?? 0) + 1); }
  const dupNos = [...seenNo.entries()].filter(([, n]) => n > 1).map(([k]) => k.split("|")[1]);
  if (dupNos.length) issues.push({ sheet: sOut?.name ?? "Outward", row: 0, text: `Invoice number used more than once: ${dupNos.slice(0, 10).join(", ")} – all are loaded, check them` });

  const bal = new Map<string, number>([...items.values()].map((i) => [i.pn, i.opening]));
  let noPn = 0, lines = 0;
  for (const d of all) for (const l of d.lines) { lines++; if (!l.pn) { noPn++; continue; } if (bal.has(l.pn)) bal.set(l.pn, r2(bal.get(l.pn)! + (d.type === "in" ? l.qty : -l.qty))); }
  const closing = [...bal.values()];
  Object.assign(stats, {
    parts: items.size, partsAddedFromInward: added, inwardEntries: all.filter((d) => d.type === "in").length, outwardInvoices: all.filter((d) => d.type === "out").length,
    lines, linesWithoutPartNo: noPn, outwardLinesNotStocked: notStocked, leadingZeroRepaired: repaired, from: dates[0] ?? "", to: dates[dates.length - 1] ?? "", openingDate,
    negative: closing.filter((b) => b < 0).length, outOfStock: closing.filter((b) => b === 0).length, low: closing.filter((b) => b > 0 && b <= LOW_STOCK).length,
  });
  return { mode: "history", items: [...items.values()], docs: all, issues, stats };
}

// ---------- writing ----------
/** Loads the yearly workbook. Everything already in the stock ledger is replaced. */
export async function applyHistory(plan: Extract<ImportPlan, { mode: "history" }>, by: { id: string; name: string }) {
  await Promise.all([StockItem.deleteMany({}), StockMove.deleteMany({}), StockDoc.deleteMany({}), StockAlert.deleteMany({})]);
  const bal = new Map<string, number>(plan.items.map((i) => [i.pn, i.opening]));
  for (const d of plan.docs) for (const l of d.lines) if (bal.has(l.pn)) bal.set(l.pn, r2(bal.get(l.pn)! + (d.type === "in" ? l.qty : -l.qty)));
  const chunk = async (model: any, rows: any[]) => { const out: any[] = []; for (let i = 0; i < rows.length; i += 1000) out.push(...(await model.insertMany(rows.slice(i, i + 1000), { ordered: false }))); return out; };
  await chunk(StockItem, plan.items.map((i) => ({ ...i, balance: bal.get(i.pn) ?? i.opening })));
  const saved = await chunk(StockDoc, plan.docs.map((d) => ({ ...d, fy: fyOf(d.date).label, qtyTotal: r2(d.lines.reduce((s, l) => s + l.qty, 0)), createdBy: by.id, createdByName: by.name, updatedByName: by.name, imported: true })));
  const moves: any[] = [];
  saved.forEach((doc: any, i: number) => { for (const l of plan.docs[i].lines) if (bal.has(l.pn)) moves.push({ pn: l.pn, date: plan.docs[i].date, dir: plan.docs[i].type, qty: l.qty, src: "doc", docId: doc._id }); });
  await chunk(StockMove, moves);
  return { parts: plan.items.length, docs: saved.length, moves: moves.length };
}

/** Applies a day sheet to `date`: new parts are added with their opening balance, and each Inward / Outward cell that
    has a number becomes that day's total for the part (an empty cell leaves the day as it is). With `apply` false
    nothing is written – the same checks run and the result says what would happen. */
export async function applyDaySheet(plan: Extract<ImportPlan, { mode: "day" }>, date: string, apply: boolean) {
  const issues: Issue[] = [...plan.issues];
  const say = (row: number, t: string) => issues.push({ sheet: plan.sheet, row, text: t });
  const pns = plan.rows.map((r) => r.pn);
  const [items, moves] = await Promise.all([
    StockItem.find({ pn: { $in: pns } }).select("pn desc location opening").lean<any[]>(),
    StockMove.find({ pn: { $in: pns } }).select("pn date dir qty src").lean<any[]>(),
  ]);
  const itemOf = new Map(items.map((i) => [i.pn as string, i]));
  const movesOf = new Map<string, any[]>();
  for (const m of moves) (movesOf.get(m.pn) ?? movesOf.set(m.pn, []).get(m.pn)!).push(m);

  const newItems: any[] = [], itemOps: any[] = [], moveOps: any[] = [], touched = new Set<string>();
  let added = 0, changed = 0, same = 0, mismatched = 0;
  for (const r of plan.rows) {
    const item = itemOf.get(r.pn), mine: any[] = movesOf.get(r.pn) ?? [];
    if (!item) {
      const add: Move[] = [];
      if (r.inward) add.push({ pn: r.pn, date, dir: "in", qty: r.inward });
      if (r.outward) add.push({ pn: r.pn, date, dir: "out", qty: r.outward });
      const opening = r.opening ?? 0;
      if (firstNewNegative({ before: opening, after: opening }, [], add)) { say(r.row, `${r.pn}: outward ${qtyText(r.outward)} is more than opening ${qtyText(opening)} + inward ${qtyText(r.inward ?? 0)} – row skipped`); continue; }
      newItems.push({ pn: r.pn, desc: r.desc, location: r.location, opening, openingDate: date, balance: opening });
      for (const m of add) moveOps.push({ insertOne: { document: { ...m, src: "manual" } } });
      touched.add(r.pn); added++;
      continue;
    }
    const set: Record<string, string> = {};
    if (r.location && r.location !== (item.location ?? "")) set.location = r.location;
    if (r.desc && !item.desc) set.desc = r.desc;
    const before = r2((item.opening ?? 0) + mine.filter((m) => m.date < date).reduce((s, m) => s + (m.dir === "in" ? m.qty : -m.qty), 0));
    if (r.opening != null && r.opening !== before) { mismatched++; say(r.row, `${r.pn}: the sheet says opening ${qtyText(r.opening)}, the ledger has ${qtyText(before)} on ${dayLabel(date)} – the ledger value is kept`); }
    let rowChanged = false, add: Move[] = []; const drop: ("in" | "out")[] = [];
    for (const [dir, total] of [["in", r.inward], ["out", r.outward]] as ["in" | "out", number | null][]) {
      if (total == null) continue;
      const today = mine.filter((m) => m.date === date && m.dir === dir);
      const fromDocs = r2(today.filter((m) => m.src === "doc").reduce((s, m) => s + m.qty, 0)), was = r2(today.reduce((s, m) => s + m.qty, 0));
      if (total === was) continue;
      if (total < fromDocs) { say(r.row, `${r.pn}: ${dir === "in" ? "inward" : "outward"} ${qtyText(total)} is less than the ${qtyText(fromDocs)} already on ${dir === "in" ? "inward entries" : "invoices"} that day – left unchanged`); continue; }
      drop.push(dir); if (total - fromDocs > 0) add.push({ pn: r.pn, date, dir, qty: r2(total - fromDocs) });
      rowChanged = true;
    }
    if (rowChanged) {
      const after = [...mine.filter((m) => !(m.src === "manual" && m.date === date && drop.includes(m.dir))), ...add];
      const hit = firstNewNegative({ before: item.opening ?? 0, after: item.opening ?? 0 }, mine, after);
      if (hit) { say(r.row, `${r.pn}: not enough stock – this would make the balance ${qtyText(hit.balance)}${hit.date ? ` on ${dayLabel(hit.date)}` : ""} – quantities left unchanged`); rowChanged = false; add = []; }
      else {
        for (const dir of drop) moveOps.push({ deleteMany: { filter: { pn: r.pn, date, dir, src: "manual" } } });
        for (const m of add) moveOps.push({ insertOne: { document: { ...m, src: "manual" } } });
        touched.add(r.pn);
      }
    }
    if (Object.keys(set).length) itemOps.push({ updateOne: { filter: { _id: item._id }, update: { $set: set } } });
    if (rowChanged || Object.keys(set).length) changed++; else same++;
  }
  if (apply) {
    if (newItems.length) await StockItem.insertMany(newItems, { ordered: false });
    if (itemOps.length) await StockItem.bulkWrite(itemOps);
    if (moveOps.length) await StockMove.bulkWrite(moveOps, { ordered: true });
    await refreshBalances([...touched], `Excel import ${dayLabel(date)}`);
  }
  return { issues, stats: { rows: plan.rows.length, added, changed, unchanged: same, openingMismatch: mismatched, skipped: plan.rows.length - added - changed - same } };
}
