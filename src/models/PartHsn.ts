import { Schema, model, models, type Model } from "mongoose";
/** HSN remembered per Graco part number – learned from saved quotations */
const PartHsnSchema = new Schema({ pn: { type: String, required: true, unique: true }, hsn: { type: String, required: true } }, { timestamps: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PartHsn: Model<any> = models.PartHsn || model("PartHsn", PartHsnSchema);
