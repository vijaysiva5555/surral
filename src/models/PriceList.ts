import { Schema, model, models, type Model } from "mongoose";

const PriceListSchema = new Schema(
  {
    year: { type: Number, required: true },
    name: { type: String, required: true },
    effectiveFrom: { type: Date, required: true },
    sourceFile: String,
    itemCount: { type: Number, default: 0 },
    importedBy: String,
  },
  { timestamps: true }
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PriceList: Model<any> = models.PriceList || model("PriceList", PriceListSchema);
