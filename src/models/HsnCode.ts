import { Schema, model, models, type Model } from "mongoose";
const HsnSchema = new Schema({ code: { type: String, required: true, unique: true, trim: true }, description: { type: String, default: "" }, gstRate: { type: Number, default: 18 }, active: { type: Boolean, default: true } }, { timestamps: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const HsnCode: Model<any> = models.HsnCode || model("HsnCode", HsnSchema);
