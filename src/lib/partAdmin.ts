import { PartPrice } from "@/models/PartPrice";

/** Replaces the list prices captured in the part editor: a number is saved, null removes that list's price. */
export async function savePartPrices(pn: string, pga: string, rows: { priceListId: string; listPrice: number | null }[]) {
  for (const r of rows) {
    if (r.listPrice === null) await PartPrice.deleteOne({ priceListId: r.priceListId, pn, pga });
    else await PartPrice.updateOne({ priceListId: r.priceListId, pn, pga }, { $set: { listPrice: r.listPrice } }, { upsert: true });
  }
}
