/* Paste support for the BOM grid: copy rows straight out of an Excel BOM sheet and paste them in. */
export const EDIT_FIELDS = ["make", "description", "qty", "listPrice", "discountPct", "landed", "marginPct"] as const;
export type EditField = (typeof EDIT_FIELDS)[number];
export type PastedRow = Partial<Record<EditField, string>>;

const num = (s: string) => { const t = s.replace(/[^\d.\-]/g, ""); return t === "" || t === "-" || t === "." ? "" : String(Number(t)); };
const isNumField = (f: EditField) => f !== "make" && f !== "description";

/** Sheet column order: S.NO, MAKE, DESCRIPTION, QTY, List Price, Total List Price, Dis, Landed Price, Total Landed, Margin, Unit Price */
const FULL: (EditField | null)[] = [null, "make", "description", "qty", "listPrice", null, "discountPct", "landed", null, "marginPct", null];

export function parseBomPaste(text: string, startField: EditField = "make"): PastedRow[] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.split("\t"));
  const out: PastedRow[] = [];
  for (const cells of lines) {
    if (cells.every((c) => !c.trim())) continue;                                   // blank row
    if (cells.some((c) => /^s\.?\s*no\.?$/i.test(c.trim())) || (cells.some((c) => /^make$/i.test(c.trim())) && cells.some((c) => /^desc/i.test(c.trim())))) continue;   // header row
    const row: PastedRow = {};
    if (cells.length >= 10) {                                                      // whole sheet width → map by column position
      FULL.forEach((f, i) => { if (f && cells[i] !== undefined && cells[i].trim() !== "") row[f] = isNumField(f) ? num(cells[i]) : cells[i].trim(); });
    } else {                                                                       // narrower block → fill the editable columns from the active cell
      const from = EDIT_FIELDS.indexOf(startField);
      cells.forEach((c, i) => { const f = EDIT_FIELDS[from + i]; if (f && c.trim() !== "") row[f] = isNumField(f) ? num(c) : c.trim(); });
    }
    if (!row.make && !row.description) continue;                                    // e.g. the grand-total line of the sheet
    out.push(row);
  }
  return out;
}
