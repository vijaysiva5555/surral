import { Schema, model, models, type Model } from "mongoose";
const CounterSchema = new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Counter: Model<any> = models.Counter || model("Counter", CounterSchema);
