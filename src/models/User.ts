import { Schema, model, models, type Model } from "mongoose";

export interface IUser { name: string; username?: string; email: string; passwordHash: string; role: "admin" | "sales" | "stock" | "viewer"; phone?: string; active: boolean; stockAlertsSeenAt?: Date }

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },   // what the user types to sign in
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "sales", "stock", "viewer"], default: "sales" },
    stockAlertsSeenAt: Date,   // the low-stock bell counts alerts newer than this
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
