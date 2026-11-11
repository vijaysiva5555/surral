import { Schema, model, models, type Model } from "mongoose";

const M = Schema.Types.Mixed;

/** Project / system offers (Promix, installation projects) — the letter-style quotation format */
const ProjectQuoteSchema = new Schema(
  {
    seq: { type: Number, required: true },
    number: { type: String, required: true, unique: true }, // SSCPL/QT/3136/26-27
    fy: String,
    date: { type: Date, required: true },
    status: { type: String, enum: ["draft", "sent", "agree", "rejected", "expired"], default: "draft", index: true },

    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customer: M, // snapshot: name, addressLines, pincode, gstin, state, stateCode, contact{name,phone}
    company: M,  // snapshot of the letterhead

    subject: String,
    intro: String,
    preparedBy: String,
    approvedBy: String,
    signerName: String,
    signerPhone: String,
    signerEmail: String,

    equipmentGraco: [String],
    equipmentSurral: [String],
    technicalTitle: String,
    specs: [M],     // [{label, value}]
    offers: [M],    // [{title, items:[{description,qty,unitPrice}], consists:[{description,qty}]}]
    exclusions: [String],
    terms: [M],     // [{label, value}]
    totals: M,      // computed server-side {total, words}

    shareToken: { type: String, index: true, sparse: true },
    shareExpiresAt: Date,
    shareViews: { type: Number, default: 0 },
    shareLastViewedAt: Date,

    createdBy: String,
    createdByName: String,
  },
  { timestamps: true }
);
ProjectQuoteSchema.index({ date: -1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ProjectQuote: Model<any> = models.ProjectQuote || model("ProjectQuote", ProjectQuoteSchema);
