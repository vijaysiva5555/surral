import { Schema, model, models, type Model } from "mongoose";

export interface IUser { name: string; email: string; passwordHash: string; role: "admin" | "sales" | "viewer"; phone?: string; active: boolean }

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "sales", "viewer"], default: "sales" },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
