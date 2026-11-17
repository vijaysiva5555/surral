/* Stock maths shared by the API, the pages and the Excel import. Pure functions – no database here.

   The ledger stores movements only (one row per inward / outward quantity on a day). Balances are never stored per day:
     opening balance of a day = first stock count + everything inward before that day − everything outward before it
     closing balance          = opening + that day's inward − that day's outward
   so a day always opens with the previous day's closing, and correcting an old day corrects every later day. */

/** a part at or below this quantity is "low stock" */
export const LOW_STOCK = 3;

/** dates are kept as plain "YYYY-MM-DD" text so a day never shifts with the server's time zone */
export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(+new Date(`${s}T00:00:00Z`));
/** today's date in India, whatever time zone the server runs in */
export const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
export const addDays = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** "2026-11-17" → "17.11.2026" */
export const dayLabel = (day?: string | null) => (day && isDay(day) ? `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}` : "");

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** quantities: zero or more, at most two decimals (hose lengths are sold by the metre) */
export const isQty = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
export const qtyText = (n: number | null | undefined) => (n == null ? "" : String(r2(n)));
/** part numbers compare as trimmed upper-case text ("24n634 " = "24N634") */
export const normPn = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").toUpperCase();

/** financial year (April – March) a day falls in: start year, label "26-27", first and last day */
export function fyOf(day: string) {
  const y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return { start, label: `${String(start).slice(2)}-${String(start + 1).slice(2)}`, from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

export type Period = "day" | "week" | "month" | "year" | "range";
/** the date range a report period covers, around `day` (weeks run Monday – Sunday, years are financial years) */
export function periodRange(period: Period, day: string, to?: string): { from: string; to: string } {
  if (period === "range") return day <= (to ?? day) ? { from: day, to: to ?? day } : { from: to ?? day, to: day };
  if (period === "week") { const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; const from = addDays(day, -dow); return { from, to: addDays(from, 6) }; }
  if (period === "month") { const last = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate(); return { from: `${day.slice(0, 7)}-01`, to: `${day.slice(0, 7)}-${String(last).padStart(2, "0")}` }; }
  if (period === "year") { const fy = fyOf(day); return { from: fy.from, to: fy.to }; }
  return { from: day, to: day };
}

export type Move = { pn: string; date: string; dir: "in" | "out"; qty: number };
const signed = (m: Move) => (m.dir === "in" ? m.qty : -m.qty);

/** The rule "stock may not go below zero", applied to a change: compares the balance after every day before and after
    the change and reports the first day the change pushes below zero (or further below zero than it already was).
    Days that were already negative and are not made worse do not block – old data may be wrong, new entries may not add to it. */
export function firstNewNegative(opening: { before: number; after: number }, before: Move[], after: Move[]): { date: string; balance: number; was: number } | null {
  const byDay = (list: Move[]) => { const m = new Map<string, number>(); for (const x of list) m.set(x.date, (m.get(x.date) ?? 0) + signed(x)); return m; };
  const a = byDay(before), b = byDay(after);
  let oldBal = opening.before, newBal = opening.after;
  if (newBal < -1e-9 && newBal < oldBal - 1e-9) return { date: "", balance: r2(newBal), was: r2(oldBal) };
  for (const day of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    oldBal += a.get(day) ?? 0; newBal += b.get(day) ?? 0;
    if (newBal < -1e-9 && newBal < oldBal - 1e-9) return { date: day, balance: r2(newBal), was: r2(oldBal) };
  }
  return null;
}

/** one row of the ledger for a date range */
export type LedgerRow = {
  id: string; pn: string; desc: string; location: string;
  opening: number; inward: number; outward: number; closing: number;
  /** the part of inward / outward that comes from inward entries and invoices – a ledger cell cannot go below it */
  docIn: number; docOut: number;
};
export const ledgerTotals = (rows: LedgerRow[]) => rows.reduce((t, r) => ({ opening: r2(t.opening + r.opening), inward: r2(t.inward + r.inward), outward: r2(t.outward + r.outward), closing: r2(t.closing + r.closing) }), { opening: 0, inward: 0, outward: 0, closing: 0 });
export const stockLevel = (balance: number): "negative" | "out" | "low" | "ok" => (balance < 0 ? "negative" : balance === 0 ? "out" : balance <= LOW_STOCK ? "low" : "ok");
