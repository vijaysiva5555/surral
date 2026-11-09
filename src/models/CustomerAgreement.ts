import { Schema, model, models, type Model } from "mongoose";
/** Special pricing for one customer. pn = "*" means every Graco part. Either a fixed unit price or a % discount. */
const AgreementSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
  pn: { type: String, required: true, uppercase: true, trim: true },
  discountPct: Number, fixedPrice: Number,
  validFrom: Date, validTo: Date, note: String, createdByName: String,
}, { timestamps: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CustomerAgreement: Model<any> = models.CustomerAgreement || model("CustomerAgreement", AgreementSchema);
