import { Schema, model, models, type Model } from "mongoose";

/* The stock module's four collections. Balances are worked out from StockMove rows (see src/lib/stockCalc.ts);
   StockItem.balance is only a cached copy of the current balance, refreshed after every change. */

/** one part kept in stock */
const StockItemSchema = new Schema(
  {
    pn: { type: String, required: true, unique: true },   // normalised: trimmed, upper case
    desc: { type: String, default: "" },
    location: { type: String, default: "" },               // rack / bin, e.g. "A-4"
    opening: { type: Number, default: 0 },                 // the first stock count, before any movement
    openingDate: String,                                   // "YYYY-MM-DD" the count was taken
    balance: { type: Number, default: 0 },                 // cached: opening + all inward − all outward
  },
  { timestamps: true }
);
StockItemSchema.index({ location: 1, pn: 1 });
StockItemSchema.index({ balance: 1 });

/** one quantity moving in or out on a day */
const StockMoveSchema = new Schema(
  {
    pn: { type: String, required: true },
    date: { type: String, required: true },                // "YYYY-MM-DD"
    dir: { type: String, enum: ["in", "out"], required: true },
    qty: { type: Number, required: true },
    src: { type: String, enum: ["manual", "doc"], required: true },   // manual = typed into a ledger cell · doc = a line of an inward entry / outward invoice
    docId: { type: Schema.Types.ObjectId, index: true, sparse: true },
  },
  { timestamps: true }
);
StockMoveSchema.index({ pn: 1, date: 1 });
StockMoveSchema.index({ date: 1 });

/** an inward entry (goods received from a supplier) or an outward invoice (goods sent to a customer) */
const StockDocSchema = new Schema(
  {
    type: { type: String, enum: ["in", "out"], required: true },
    no: { type: String, default: "" },                     // invoice number
    date: { type: String, required: true },                // invoice date – the day the stock moves
    fy: String,                                            // financial year "26-27"; outward invoice numbers are unique inside one
    party: { type: String, default: "" },                  // supplier (inward) or customer name (outward)
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    remarks: { type: String, default: "" },
    lines: [new Schema({ pn: { type: String, default: "" }, desc: { type: String, default: "" }, qty: { type: Number, default: 0 }, remarks: { type: String, default: "" } }, { _id: false })],
    qtyTotal: { type: Number, default: 0 },
    createdBy: String, createdByName: String, updatedByName: String,
    imported: Boolean,                                     // came from the Excel history load
  },
  { timestamps: true }
);
StockDocSchema.index({ type: 1, date: -1 });
StockDocSchema.index({ type: 1, fy: 1, no: 1 });
StockDocSchema.index({ "lines.pn": 1 });

/** a part that dropped to the low-stock level; removed again when its balance is back above it */
const StockAlertSchema = new Schema({
  pn: { type: String, required: true, unique: true },
  desc: String, location: String, balance: Number, cause: String,
  at: { type: Date, default: Date.now, index: true },
});

/* eslint-disable @typescript-eslint/no-explicit-any */
export const StockItem: Model<any> = models.StockItem || model("StockItem", StockItemSchema);
export const StockMove: Model<any> = models.StockMove || model("StockMove", StockMoveSchema);
export const StockDoc: Model<any> = models.StockDoc || model("StockDoc", StockDocSchema);
export const StockAlert: Model<any> = models.StockAlert || model("StockAlert", StockAlertSchema);
