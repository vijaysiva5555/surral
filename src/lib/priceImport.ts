import ExcelJS from "exceljs";
import { cellText } from "./excel";

export type PriceRow = { pn: string; pga: string; desc: string; division: string; application: string; discountCode: string; sbu: string; familyCode: string; listPrice: number; itemStatus: string; recordType: string };
export type ParsedPriceList = {
  title: string; year: number | null; effectiveFrom: string | null; rows: PriceRow[];
  stats: { rawRows: number; duplicateKeys: number; duplicateSamples: string[]; zeroPrice: number; badPrice: number; byStatus: Record<string, number>; byDivision: Record<string, number> };
};

/** "Effective Oct 13th, 2025" / "Effective January 4th, 2027" -> ISO date */
export function parseEffective(text: string): string | null {
  // also copes with file names: "2027_India_INR_-_Effective_January_4th_2027.xlsx", "Effective Oct,13th, 2025"
  const clean = text.replace(/[_\s]+/g, " ").replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  const m = clean.match(/Effective\s+([A-Za-z]+)\.?\s*,?\s*(\d{1,2})\s*,?\s*(\d{4})/i);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 12:00:00 UTC`);
  return isNaN(+d) ? null : d.toISOString().slice(0, 10);
}

/** Reads Graco's "India_INR" sheet: title in B1, header row starting "Part Number", 10 data columns + record type */
export async function parsePriceWorkbook(data: Buffer, fileName = ""): Promise<ParsedPriceList> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(data as any);
  const ws = wb.getWorksheet("India_INR") ?? wb.worksheets.find((w) => /INR|price/i.test(w.name)) ?? wb.worksheets[0];

  let headerRow = 0;
  // header cell may be in column A or B depending on the file; scan the first 10 rows
  for (let r = 1; r <= 10 && !headerRow; r++) if (/^part\s*number$/i.test(cellText(ws.getRow(r).getCell(1).value).trim())) headerRow = r;
  if (!headerRow) throw new Error('Could not find the header row ("Part Number") in sheet ' + ws.name);

  // Newer files have no title block (header is row 1) – fall back to the price column header, then the file name
  const title = cellText(ws.getCell("B1").value).replace(/\s+/g, " ").trim();
  const priceHeader = cellText(ws.getRow(headerRow).getCell(9).value).replace(/\s+/g, " ").trim(); // "2027 India INR List Price"
  const source = [title, fileName];
  const year = Number(title.match(/\b(20\d{2})\b/)?.[1]) || Number(priceHeader.match(/\b(20\d{2})\b/)?.[1]) || Number(fileName.match(/(?:^|[^\d])(20\d{2})(?!\d)/)?.[1]) || null;
  const effectiveFrom = source.map(parseEffective).find(Boolean) ?? null;

  const map = new Map<string, PriceRow>();
  const stats = { rawRows: 0, duplicateKeys: 0, duplicateSamples: [] as string[], zeroPrice: 0, badPrice: 0, byStatus: {} as Record<string, number>, byDivision: {} as Record<string, number> };

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const pn = cellText(row.getCell(1).value).trim().toUpperCase();
    if (!pn) continue;
    stats.rawRows++;
    const priceRaw = row.getCell(9).value;
    const price = typeof priceRaw === "number" ? priceRaw : Number(cellText(priceRaw).replace(/,/g, ""));
    if (!Number.isFinite(price) || price < 0) { stats.badPrice++; continue; }
    if (price === 0) stats.zeroPrice++;
    const t = (c: number) => cellText(row.getCell(c).value).trim();
    const item: PriceRow = { pn, pga: t(3), desc: t(2), division: t(4), application: t(5), discountCode: t(6), sbu: t(7), familyCode: t(8), listPrice: price, itemStatus: t(10), recordType: t(11) };
    const key = `${pn}|${item.pga}`;
    if (map.has(key)) { stats.duplicateKeys++; if (stats.duplicateSamples.length < 5) stats.duplicateSamples.push(key); }
    map.set(key, item);
    stats.byStatus[item.itemStatus || "—"] = (stats.byStatus[item.itemStatus || "—"] ?? 0) + 1;
    stats.byDivision[item.division || "—"] = (stats.byDivision[item.division || "—"] ?? 0) + 1;
  }
  return { title, year, effectiveFrom, rows: [...map.values()], stats };
}
