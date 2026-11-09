import { Schema, model, models, type Model } from "mongoose";
const PasswordResetSchema = new Schema({ userId: { type: Schema.Types.ObjectId, required: true, index: true }, tokenHash: { type: String, required: true, unique: true }, expiresAt: { type: Date, required: true, expires: 0 } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PasswordReset: Model<any> = models.PasswordReset || model("PasswordReset", PasswordResetSchema);
