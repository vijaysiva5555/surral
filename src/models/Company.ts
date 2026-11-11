import { Schema, model, models, type Model } from "mongoose";

const CompanySchema = new Schema(
  {
    name: { type: String, required: true },
    tagline: String, // e.g. "Authorised Distributor for M/s.Graco Inc - USA"
    addressLines: [String],
    state: String,
    stateCode: String,
    gstin: String,
    phone: String,
    mobile: String,
    website: String,
    email: String,
    quotePrefix: { type: String, default: "SSCPL/SQ" },
    quoteStartNo: { type: Number, default: 1 },
    projectPrefix: { type: String, default: "SSCPL/QT" }, // project / system offers (Equipment & Project quotations)
    projectStartNo: { type: Number, default: 1 },
    logoData: String,        // data URL, shown top-left on quotations (falls back to /public/sscpl-logo.png)
    partnerLogoData: String, // data URL, shown top-right (falls back to /public/graco-logo.png)
    bank: { name: String, branch: String, accountNo: String, ifsc: String },
  },
  { timestamps: true }
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Company: Model<any> = models.Company || model("Company", CompanySchema);
