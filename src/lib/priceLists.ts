/** the price list in force on a date: latest effective-from on or before it (else the earliest) */
export function pickList<T extends { _id: string; effectiveFrom: string }>(lists: T[], date: string): string {
  const asc = [...lists].sort((a, b) => +new Date(a.effectiveFrom) - +new Date(b.effectiveFrom));
  return ([...asc].reverse().find((l) => l.effectiveFrom.slice(0, 10) <= date) ?? asc[0])?._id ?? "";
}
