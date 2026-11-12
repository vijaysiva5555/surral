/* Server only. Revisions and duplicates of a quotation share the same S3 photos, so a photo is deleted from S3
   only once no other quotation still lists it. */
import { Quote } from "@/models/Quote";
import { deleteObjects } from "./s3";

export async function releaseQuoteImages(keys: string[], quoteId: unknown) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return;
  const stillUsed = new Set((await Quote.distinct("images", { images: { $in: unique }, _id: { $ne: quoteId } })) as string[]);
  await deleteObjects(unique.filter((k) => !stillUsed.has(k)));
}
