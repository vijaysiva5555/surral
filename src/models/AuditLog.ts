import { Schema, model, models, type Model } from "mongoose";
const AuditSchema = new Schema({
  at: { type: Date, default: Date.now, index: true },
  userId: String, userName: String, role: String, action: String, entity: String, entityId: String, summary: String,
  // what was modified, before → after (entries written before this field existed have none)
  changes: { type: [new Schema({ field: String, from: String, to: String }, { _id: false })], default: undefined },
});
AuditSchema.index({ entity: 1, at: -1 });
AuditSchema.index({ userId: 1, at: -1 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AuditLog: Model<any> = models.AuditLog || model("AuditLog", AuditSchema);
