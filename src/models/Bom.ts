import { Schema, model, models, type Model } from "mongoose";

const ItemSchema = new Schema({ make: String, description: String, qty: Number, listPrice: Number, discountPct: Number, landed: Number, marginPct: Number }, { _id: false });
const BomSchema = new Schema({
  category: { type: String, enum: ["spare", "equipment"], default: "equipment", index: true },
  name: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  image: String,                               // optional product photo, offered to the quotation
  items: [ItemSchema],
  createdBy: String, createdByName: String,
}, { timestamps: true });
BomSchema.index({ category: 1, name: 1 }, { unique: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Bom: Model<any> = models.Bom || model("Bom", BomSchema);
