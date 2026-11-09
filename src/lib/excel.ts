import type ExcelJS from "exceljs";
/** Plain text of any ExcelJS cell value (handles rich text, formulas, hyperlinks) */
export function cellText(v: ExcelJS.CellValue | undefined): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return (v.richText as { text: string }[]).map((r) => r.text).join("");
    if ("result" in v) return String((v as { result: unknown }).result ?? "");
    if ("text" in v) return String((v as { text: unknown }).text);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}
