import { Schema, model, models, type Model } from "mongoose";

/** small app-wide settings, one document per key (e.g. "pageAccess": which roles may open which page) */
const AppSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: Schema.Types.Mixed,
    updatedByName: String,
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AppSetting: Model<any> = models.AppSetting || model("AppSetting", AppSettingSchema);
