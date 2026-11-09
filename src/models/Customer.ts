import { Schema, model, models, type Model } from "mongoose";

const ContactSchema = new Schema({ name: String, phone: String, email: String, designation: String }, { _id: false });

const CustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    addressLines: [String],
    pincode: String,
    gstin: { type: String, uppercase: true, trim: true },
    state: String,
    stateCode: String,
    contacts: [ContactSchema],
    standardDiscountPct: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
CustomerSchema.index({ name: "text", gstin: "text" });
CustomerSchema.index({ gstin: 1 }, { unique: true, partialFilterExpression: { gstin: { $type: "string", $gt: "" } } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Customer: Model<any> = models.Customer || model("Customer", CustomerSchema);
