import { Schema, model, models, type Model } from "mongoose";
const AuditSchema = new Schema({
  at: { type: Date, default: Date.now, index: true },
  userId: String, userName: String, action: String, entity: String, entityId: String, summary: String,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AuditLog: Model<any> = models.AuditLog || model("AuditLog", AuditSchema);
