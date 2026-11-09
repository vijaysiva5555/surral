import { Schema, model, models, type Model } from "mongoose";
const TermTemplateSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  terms: [{ _id: false, label: { type: String, default: "" }, value: { type: String, default: "" } }],
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TermTemplate: Model<any> = models.TermTemplate || model("TermTemplate", TermTemplateSchema);
