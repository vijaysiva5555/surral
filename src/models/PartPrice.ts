import { Schema, model, models, type Model } from "mongoose";

const PartPriceSchema = new Schema({
  priceListId: { type: Schema.Types.ObjectId, ref: "PriceList", required: true },
  pn: { type: String, required: true },
  pga: { type: String, default: "" },
  listPrice: { type: Number, required: true },
});
PartPriceSchema.index({ priceListId: 1, pn: 1, pga: 1 }, { unique: true });
PartPriceSchema.index({ pn: 1 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PartPrice: Model<any> = models.PartPrice || model("PartPrice", PartPriceSchema);
