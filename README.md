# Surral Quote

Quotation management for Surral Surface Coatings Pvt. Ltd.
Next.js 14 (App Router, TypeScript) · MongoDB (Mongoose) · NextAuth · Tailwind · @react-pdf/renderer · ExcelJS

## Run locally
```bash
cp .env.example .env.local     # set MONGODB_URI and NEXTAUTH_SECRET (openssl rand -base64 32)
npm install
npm run seed                   # admin, company, customers (data/Customer_Details.xlsx), 3 sample BOMs, 3 demo quotations
npm run seed-demo              # BOM samples + demo quotations only (if you already ran seed)
npm run dev                    # http://localhost:3000
```
Default admin (change it after first login): `admin@surral.in` / `Admin@123`

## First-time setup order
1. **Company** page – check the letterhead details and "Next quote no. starts at" (seed uses 2489).
2. **Pricing → Price lists → Import** – upload Graco's 2026 file, then the 2027 file (year and effective date are detected).
3. **Pricing → Discount rules** – enter your distributor discount % per Graco discount code (not present in Graco's files).
3b. **Parts master** (admin) – add a missing Graco part, or correct a description, HSN, discount code or list price by hand.
4. **Users** – add Sales / Viewer users (each person can set their own phone under *My profile*).
4b. **Terms templates / HSN codes** – optional; set the default terms and import your HSN list.
5. **Quotations → New quotation.**

## What is built
| Phase | Module | Status |
|---|---|---|
| 1 | Login, roles (admin / sales / viewer), user master, company settings, customer master + Excel import | done |
| 2 | Yearly price lists (import wizard with preview), part search, year-to-year comparison, discount rules, **parts master** (admin: add / edit / delete a part with HSN and per-list prices) | done |
| 3 | Quotation panel: customer picker, Graco-part search, packages, custom items, GST with an explicit tax type (auto by state, IGST, or CGST+SGST), round-off, amount in words, auto numbering, terms, product image, live preview, duplicate / revise, status flow | done |
| 4 | PDF and Excel quotation (template layout), internal costing workbook, dashboard analytics, audit log | done |
| 5 | **Share link** with view count · **HSN master** with auto-fill · **customer price agreements** + standard discount · **password change** (My profile) · **auto-expire** of sent quotations · **terms templates** · **logo upload** · **Excel export** of quotations and customers · login lockout | done |
| 6 | **BOM packages** (separate module): spreadsheet-style grid, paste from Excel, saved BOMs used to create quotation package lines | done |

Quotations are never e-mailed: a customer gets the **share link**, or you send them the PDF / Excel download yourself. The only mail the app sends is the optional password-reset link.

## BOM packages
*BOM packages* in the menu (admin and sales only – BOMs hold landed cost and margins).
1. **New BOM** – enter *BOM name* and *Date* (and an optional photo), then fill the grid like an Excel sheet: MAKE, DESCRIPTION, QTY, List Price, Dis %, Landed Price (only for items without a list price), Margin %. S.NO, Total List Price, Total Landed and Unit Price calculate themselves.
   - Enter / ↑ / ↓ move between rows. You can **copy rows from your Excel BOM sheet and paste them into the MAKE cell** – the header, blank rows and the grand-total line are skipped.
   - Typing a Graco part number in MAKE (or using the search box) fills description, list price and discount from the price list.
2. **Price of the BOM** = the **Total Unit Price** (Σ unit price × qty), shown in the Totals row under the grid. Row rule: unit price = landed × (1 + margin %), rounded up to the next rupee.
3. **Save.** On a quotation click **BOM package**, choose the BOM: the package line gets the BOM name, the "Consists of" list (a., b., c. …), the price and (if the BOM has one) the photo. Code ("Graco" by default), HSN and UOM are filled on the quotation line itself. The BOM is copied into the quotation, so later BOM edits or deletion never change an issued quotation; use *Reload latest BOM* to pull changes in on purpose.
4. *Costing* on a quotation downloads the BOM sheet(s) in Excel (admin / sales only). The customer never sees BOM data – not on the PDF, Excel or share link.
`npm run seed` (or `npm run seed-demo`) creates three sample BOMs — *Triton Pump Air Spray Package* (from the Simpson sheet), *Electric Airless Spray Package*, and *Heavy-Duty Texture Sprayer Package* — plus three demo quotations (draft, sent, agree) on the first customer so the dashboard and quotation list are populated.

## Rules worth knowing
- Part key is **Part Number + PGA** (13 part numbers appear twice with different prices).
- A quote uses the price list whose *effective date* is the latest on/before the quote date (override possible).
- Totals are always recomputed on the server; quote lines keep a price snapshot, so later price-list or customer changes never alter an issued quote.
- BOM and cost data is internal: never printed, never on the share link, and hidden from viewers.
- Quote numbers run continuously (`SSCPL/SQ/<no.>/<FY>`); the financial year is April–March.
- Sales users can edit only their own quotes; admins can edit all; viewers are read-only. No approval step is needed – sales can issue the PDF, Excel and share link directly.
- Terms templates and HSN codes are maintained by admins and sales users; viewers can browse the HSN list.
- A part number typed into a quotation's CODE column is added to the parts master when it is not there yet; existing parts are never overwritten.
- Customer pricing order for a Graco part: that customer's agreement for the part → the customer's "*" (all parts) agreement → the customer's standard discount.
- Share links expire 30 days after the quotation's validity ends and can be switched off at any time; the public page never shows costing or cost price.
- A "sent" quotation whose validity has ended becomes "expired" automatically (drafts are left alone).

## Password reset (optional mail)
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` to let people reset their own password from `/forgot`; `MAIL_TRANSPORT=file` writes the message to `.mail-outbox/` instead of sending it. Without mail configured the reset link is printed in the server log, and an administrator can always set a password on the Users page.

## Not included
Multi-company (single company only), e-mailing quotations. Rate limiting is in-memory, per server process.
