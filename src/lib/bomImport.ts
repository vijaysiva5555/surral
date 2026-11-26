/* eslint-disable @typescript-eslint/no-explicit-any */
/* Reads the company's Excel BOM workbook (e.g. "Excel Format.xlsx") into BOM sections.
   A sheet holds one or more blocks; each block is
     a title row          e.g. "Promix 1K - 5Color, 1 Auto Drop, 1 Manual Drop"
     a header row         S.NO | Part No: | Description | Qty | List Price in INR | Total Price | Dis | Net Price | Total net price |
                          Margin 20% | Unit Price | Total Price | Margin 15% | Unit Price | Total Price | Notes
     item rows            (a Graco part with list price and discount, or a bought-out item with only the net / landed price)
     a summary row        "Landed … Total …" (skipped)
   Columns are found by their header text, so a moved or added column still reads correctly. Calculated columns are not
   imported – the BOM works them out again (unit price = landed × (1 + margin), rounded up). */
import ExcelJS from "exceljs";
import { cellText } from "./excel";

export type ImportedItem = { make: string; description: string; qty: number; listPrice: number; discountPct: number; landed: number; marginPct: number; margin2Pct: number; notes: string };
export type ImportedBlock = { title: string; items: ImportedItem[] };
export type ImportedSheet = { name: string; blocks: ImportedBlock[] };

type Cols = { sno?: number; make: number; desc: number; qty: number; list?: number; dis?: number; net?: number; margin?: number; unit?: number; margin2?: number; unit2?: number; notes?: number; last: number; marginDefault?: number; margin2Default?: number };

/** a number from a cell: plain numbers, formula results, "1,000", "45%" (→ 45) */
function num(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "object") {
    if (v instanceof Date) return null;
    if ("result" in v) return num(v.result);
    if ("richText" in v) return num(cellText(v));
    if ("error" in v) return null;
  }
  const t = String(v).trim();
  if (!t || !/^[-+]?[\d,]*\.?\d+\s*%?$/.test(t)) return null;
  const n = Number(t.replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? (t.endsWith("%") ? n / 100 : n) : null;
}
/** a percentage: Excel keeps 45 % as 0.45; a typed 45 stays 45 */
const pct = (v: any): number | null => { const n = num(v); if (n == null) return null; return Math.round((Math.abs(n) <= 1 ? n * 100 : n) * 10000) / 10000; };
const text = (v: any) => cellText(v).replace(/\s+/g, " ").trim();
/** text typed where a number belongs (e.g. "added air line setup cost" in the List Price column) – kept as a note */
const strayText = (v: any) => { if (v == null || typeof v === "number") return ""; const t = text(v); return t && num(v) == null ? t : ""; };

const isHeader = (row: ExcelJS.Row) => {
  let sno = false, desc = false;
  row.eachCell((c) => { const t = text(c.value).toLowerCase(); if (/^s\.?\s*no\.?:?$/.test(t) || t === "sl.no" || t === "sr.no") sno = true; if (/^desc/.test(t)) desc = true; });
  return sno && desc;
};

function readHeader(row: ExcelJS.Row, prevNotes?: number): Cols {
  const c: Partial<Cols> = {}; let last = 0;
  row.eachCell((cell, n) => {
    const t = text(cell.value).toLowerCase(); if (!t) return; last = Math.max(last, n);
    if (/^s\.?\s*no|^sl\.?\s*no|^sr\.?\s*no/.test(t)) c.sno ??= n;
    else if (/part\s*no|^make|part\s*number/.test(t)) c.make ??= n;
    else if (/^desc/.test(t)) c.desc ??= n;
    else if (/^qty|quantity/.test(t)) c.qty ??= n;
    else if (/list\s*price/.test(t)) c.list ??= n;
    else if (/^dis/.test(t)) c.dis ??= n;
    else if (/net\s*price|landed\s*price/.test(t) && !/total/.test(t)) c.net ??= n;
    else if (/^margin/.test(t)) {
      const d = pct((t.match(/(\d+(?:\.\d+)?)\s*%/) ?? [])[1] ?? null);
      if (c.margin == null) { c.margin = n; c.marginDefault = d ?? undefined; } else if (c.margin2 == null) { c.margin2 = n; c.margin2Default = d ?? undefined; }
    } else if (/^unit\s*price/.test(t)) { if (c.margin2 != null && n > c.margin2) c.unit2 ??= n; else c.unit ??= n; }
    else if (/^notes?$|remarks?/.test(t)) c.notes ??= n;
  });
  // the company's layout, for anything the header does not name
  const cols: Cols = { make: c.make ?? 2, desc: c.desc ?? 3, qty: c.qty ?? 4, last, ...c } as Cols;
  cols.list ??= 5; cols.dis ??= 7; cols.net ??= 8; cols.margin ??= 10; cols.unit ??= 11; cols.margin2 ??= 13; cols.unit2 ??= 14;
  // a block whose header has no "Notes" keeps writing notes in the same column as the block before (or the one after the last price)
  cols.notes ??= prevNotes ?? Math.max(cols.last, cols.unit2 + 1) + 1;
  return cols;
}

function readItem(row: ExcelJS.Row, cols: Cols): ImportedItem | null {
  const get = (n?: number) => (n ? row.getCell(n).value : null);
  const make = text(get(cols.make)), description = text(get(cols.desc));
  if (!make && !description) return null;                       // blank / summary rows ("Landed", "Total")
  const list = num(get(cols.list)), net = num(get(cols.net)), unit = num(get(cols.unit)), unit2 = num(get(cols.unit2));
  // text with no part number, quantity or price is the title of the next block, not an item
  if (!make && num(get(cols.qty)) == null && !list && !net && !unit && !unit2) return null;
  const m1 = pct(get(cols.margin)) ?? cols.marginDefault ?? 20, m2 = pct(get(cols.margin2)) ?? cols.margin2Default ?? 0;
  const notes: string[] = [];
  const noteCell = text(get(cols.notes)); if (noteCell && num(get(cols.notes)) == null) notes.push(noteCell);
  for (const n of [cols.qty, cols.list, cols.dis, cols.net, cols.margin, cols.unit, cols.margin2, cols.unit2]) { const s = strayText(get(n)); if (s) notes.push(s); }
  row.eachCell((cell, n) => { if (n > (cols.notes ?? 0)) { const s = strayText(cell.value); if (s) notes.push(s); } });   // remarks further right
  const item: ImportedItem = { make, description, qty: num(get(cols.qty)) || 1, listPrice: 0, discountPct: 0, landed: 0, marginPct: m1, margin2Pct: m2, notes: "" };
  if (list && list > 0) { item.listPrice = list; item.discountPct = pct(get(cols.dis)) ?? 0; }
  else if (net && net > 0) item.landed = net;
  else if (unit && unit > 0) { item.landed = unit; item.marginPct = 0; }                           // only the price after the first margin is known
  else if (unit2 && unit2 > 0) { item.landed = unit2; item.marginPct = 0; item.margin2Pct = 0; notes.push("Selling price as given"); }   // a direct selling price
  item.notes = [...new Set(notes)].join(" · ").slice(0, 1000);
  return item;
}

export async function parseBomWorkbook(data: ArrayBuffer): Promise<ImportedSheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(data) as any);
  const out: ImportedSheet[] = [];
  for (const ws of wb.worksheets) {
    if (ws.state && ws.state !== "visible") continue;
    const blocks: ImportedBlock[] = [];
    let cols: Cols | null = null, cur: ImportedBlock | null = null, lastText = "";
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      if (isHeader(row)) {
        cols = readHeader(row, cols?.notes);
        cur = { title: lastText || `${ws.name} ${blocks.length + 1}`, items: [] }; blocks.push(cur); lastText = "";
        continue;
      }
      if (cols && cur) {
        const it = readItem(row, cols);
        if (it) { cur.items.push(it); continue; }
      }
      // a row of text only (no prices) before the next header is that block's title
      const texts: string[] = []; let numbers = 0;
      row.eachCell((c) => { if (num(c.value) != null) numbers++; else { const t = text(c.value); if (t) texts.push(t); } });
      if (texts.length && !numbers && !/^(landed|total)$/i.test(texts[0])) lastText = texts[0].slice(0, 80);
    }
    const kept = blocks.filter((b) => b.items.length);
    if (kept.length) out.push({ name: ws.name, blocks: kept });
  }
  return out;
}
