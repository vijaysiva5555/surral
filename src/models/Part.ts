import { Schema, model, models, type Model } from "mongoose";

const PartSchema = new Schema(
  {
    pn: { type: String, required: true, index: true },
    pga: { type: String, default: "" },
    desc: { type: String, default: "" },
    division: String, application: String, discountCode: String, sbu: String, familyCode: String,
    itemStatus: String, recordType: String,
    // Per-part distributor discount scraped from the Graco Partner Portal (scripts/fetchDiscounts.ts).
    // When set it wins over the discount-code rule.
    partnerDiscountPct: Number, partnerNetPrice: Number, partnerResolvedPn: String, partnerDiscountAt: Date,
  },
  { timestamps: true }
);
PartSchema.index({ pn: 1, pga: 1 }, { unique: true });
PartSchema.index({ discountCode: 1 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Part: Model<any> = models.Part || model("Part", PartSchema);
