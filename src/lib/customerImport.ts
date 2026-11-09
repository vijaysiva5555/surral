import ExcelJS from "exceljs";
import { cleanCompany, cleanGstin, cleanPerson, cleanPhone, findPincode, stateFromGstin } from "./india";

export type ParsedCustomer = {
  name: string; addressLines: string[]; pincode: string; gstin: string; state: string; stateCode: string;
  contacts: { name: string; phone: string; email: string; designation: string }[];
};

const txt = (v: ExcelJS.CellValue | undefined) => {
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text);
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "");
  return String(v);
};

/** Reads the block-style Customer_Details sheet: a numbered row starts a customer, rows below (no number) are address lines. */
export async function parseCustomerWorkbook(data: Buffer | ArrayBuffer): Promise<ParsedCustomer[]> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(data as any);
  const ws = wb.worksheets[0];
  const out: ParsedCustomer[] = [];
  let cur: ParsedCustomer | null = null;

  ws.eachRow((row) => {
    const a = txt(row.getCell(1).value).trim();
    const b = txt(row.getCell(2).value).replace(/\s+/g, " ").trim();
    if (/^\d+$/.test(a)) {
      const gstin = cleanGstin(txt(row.getCell(3).value));
      const person = cleanPerson(txt(row.getCell(4).value));
      const phone = cleanPhone(txt(row.getCell(5).value));
      cur = {
        name: cleanCompany(b), addressLines: [], pincode: "", gstin, ...stateFromGstin(gstin),
        contacts: person || phone ? [{ name: person, phone, email: "", designation: "" }] : [],
      };
      out.push(cur);
    } else if (cur && b) {
      cur.addressLines.push(b.replace(/[,\s]+$/, ""));
    }
  });
  for (const c of out) c.pincode = findPincode(c.addressLines.join(" "));
  return out;
}
