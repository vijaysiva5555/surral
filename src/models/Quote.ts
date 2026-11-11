import { Schema, model, models, type Model } from "mongoose";

const M = Schema.Types.Mixed;
const QuoteSchema = new Schema(
  {
    category: { type: String, enum: ["spare", "equipment"], default: "spare", index: true },
    seq: { type: Number, required: true },
    revision: { type: Number, default: 0 },
    number: { type: String, required: true },   // e.g. SSCPL/SQ/2488/26-27
    fy: String,
    date: { type: Date, required: true },
    validityDays: { type: Number, default: 30 },
    validUntil: Date,
    referredBy: String,
    status: { type: String, enum: ["draft", "sent", "agree", "rejected", "expired", "superseded"], default: "draft", index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customer: M,        // snapshot: name, addressLines, pincode, gstin, state, stateCode, contact{name,phone}
    company: M,         // snapshot of company header at creation
    preparedBy: M,      // {name, phone}
    priceListId: { type: Schema.Types.ObjectId, ref: "PriceList" },
    lines: [M],
    terms: [M],         // [{label,value}]
    gstRate: { type: Number, default: 18 },
    taxType: { type: String, enum: ["auto", "intra", "inter"], default: "auto" },   // GST split: auto from the state codes, or forced intra/inter
    totals: M,          // computed server-side
    image: String,      // optional product image (data URL)
    imageCaption: String,
    shareToken: { type: String, index: true, sparse: true },
    shareExpiresAt: Date, shareViews: { type: Number, default: 0 }, shareLastViewedAt: Date,
    createdBy: String, createdByName: String,
  },
  { timestamps: true }
);
QuoteSchema.index({ category: 1, seq: 1, revision: 1 }, { unique: true });
QuoteSchema.index({ date: -1 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Quote: Model<any> = models.Quote || model("Quote", QuoteSchema);
