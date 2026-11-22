# Surral Quote

Quotation management for Surral Surface Coatings Pvt. Ltd.
Next.js 16 (App Router, Turbopack, TypeScript) · React 19 · MongoDB (Mongoose) · NextAuth · Tailwind · @react-pdf/renderer · ExcelJS · Node.js 20.9 or newer

## Run locally
```bash
cp .env.example .env.local     # set MONGODB_URI and NEXTAUTH_SECRET (openssl rand -base64 32)
npm install
npm run seed                   # admin, company, customers (data/Customer_Details.xlsx), 3 sample BOMs, 3 demo quotations
npm run seed-demo              # BOM samples + demo quotations only (if you already ran seed)
npm run dev                    # http://localhost:3000
```
`npm run dev` is for development only: it compiles every page the first time it is opened, so first clicks take several seconds.
For day-to-day use run the production build, which answers in a fraction of a second:
```bash
npm run build
npm start                      # http://localhost:3000  (npm start -- -p 3100 for another port)
```
Default admin (change it after first login): `admin@surral.in` / `Admin@123`

## First-time setup order
1. **Company** page – check the letterhead details and "Next quote no. starts at" (seed uses 2489).
2. **Pricing → Price lists → Import** – upload Graco's 2026 file, then the 2027 file (year and effective date are detected).
3. **Pricing → Discount rules** – enter your distributor discount % per Graco discount code (not present in Graco's files).
3b. **Parts master** (admin) – add a missing Graco part, or correct a description, HSN, discount code or list price by hand.
4. **Users** – add Sales / Stock / Viewer users (each person can set their own phone under *My profile*).
4b. **Terms templates / HSN codes** – optional; set the default terms and import your HSN list.
5. **Quotations → New quotation.**

## What is built
| Phase | Module | Status |
|---|---|---|
| 1 | Login, roles (admin / sales / stock / viewer), user master, company settings, customer master + Excel import | done |
| 2 | Yearly price lists (import wizard with preview), part search, year-to-year comparison, discount rules, **parts master** (admin: add / edit / delete a part with HSN and per-list prices) | done |
| 3 | Quotation panel: customer picker, Graco-part search, packages, custom items, GST with an explicit tax type (auto by state, IGST, or CGST+SGST), round-off, amount in words, auto numbering, terms, product image, live preview, duplicate / revise, status flow | done |
| 4 | PDF and Excel quotation (template layout), internal costing workbook, dashboard analytics, audit log | done |
| 5 | **Share link** with view count · **HSN master** with auto-fill · **customer price agreements** + standard discount · **password change** (My profile) · **auto-expire** of sent quotations · **terms templates** · **logo upload** · **Excel export** of quotations and customers · login lockout | done |
| 6 | **BOM packages** (separate module): spreadsheet-style grid, paste from Excel, saved BOMs used to create quotation package lines | done |

**Project quotations** download as PDF or as an editable **Word document (.docx)** laid out like the company’s own project offer (`src/lib/projectDocx.ts`): cover page (logo, “Designing, Drafting, Manufacturing, Installation and Commissioning of <system>”, cover photo, `public/docx/cover-decor.png`), then the letterhead banner (`public/docx/letterhead.png`) and Web / E-Mail footer on every page – letter and summary table, one TECHNICAL DESCRIPTION per item (spec table with its photo), COMMERCIAL OFFER (each offer on its own page with Graco and Surral supply lists), OFFER TOTAL (offers plus extra lines such as installation and freight), exclusions, terms and the warranty. The Word file is built from the last saved version; the footer e-mail comes from the Company page. **Load demo content** on a new project quotation fills the form with a complete Promix 2KS sample (`src/lib/projectDemo.ts`, photos in `public/demo/project`).

Quotations are never e-mailed: a customer gets the **share link**, or you send them the PDF / Excel download yourself. The only mail the app sends is the optional password-reset link.

## BOM packages
*BOM packages* in the menu (admin and sales only – BOMs hold landed cost and margins).
1. **New BOM** – enter *BOM name* and *Date* (and an optional photo), then fill the grid like an Excel sheet: MAKE, DESCRIPTION, QTY, List Price, Dis %, Landed Price (only for items without a list price), Margin %, Margin 2 % (optional). S.NO, Total List Price, Total Landed, both Unit Price columns and both Total Price columns calculate themselves.
   - Enter / ↑ / ↓ move between rows. You can **copy rows from your Excel BOM sheet and paste them into the MAKE cell** – the header, blank rows and the grand-total line are skipped.
   - Typing a Graco part number in MAKE (or using the search box) fills description, list price and discount from the price list.
2. **Price of the BOM** = the last **Total Price** column (Σ unit price × qty), shown in the Totals row under the grid. Row rule: unit price = landed × (1 + margin %), rounded up to the next rupee. A row with a **Margin 2 %** gets a second unit price = unit price × (1 + margin 2 %), to two decimals (78 + 15 % = 89.70), and that is the price used; a row without one keeps the first unit price.
3. **Save.** On a quotation click **BOM package**, choose the BOM: the package line gets the BOM name, the "Consists of" list (a., b., c. …), the price and (if the BOM has one) the photo. Code ("Graco" by default), HSN and UOM are filled on the quotation line itself. The BOM is copied into the quotation, so later BOM edits or deletion never change an issued quotation; use *Reload latest BOM* to pull changes in on purpose.
4. *Costing* on a quotation downloads the BOM sheet(s) in Excel (admin / sales only). The customer never sees BOM data – not on the PDF, Excel or share link.
`npm run seed` (or `npm run seed-demo`) creates three sample BOMs — *Triton Pump Air Spray Package* (from the Simpson sheet), *Electric Airless Spray Package*, and *Heavy-Duty Texture Sprayer Package* — plus three demo quotations (draft, sent, agree) on the first customer so the dashboard and quotation list are populated.

## Stock

Sidebar group **Stock**: Inward, Outward, Ledger, Reports. Admin and stock users enter data; sales and viewers see the same pages read only. Stock users see quotations read only and never BOM / cost data. Who may do what lives in `src/lib/roles.ts`.

- The ledger stores **movements only**; balances are calculated (`src/lib/stockCalc.ts`): a day's opening balance = first stock count + everything inward before it − everything outward before it, so each day opens with the previous day's closing and correcting an old day corrects every later day.
- **Outward invoice / Inward entry** – invoice no., invoice date, customer / supplier, item lines. The stock moves on the **invoice date**. Lines without a part number, and outward lines for a part that is not on the ledger, are kept on the invoice but do not change stock. An outward invoice number is unique within a financial year.
- **Ledger** – the sheet shows Location, Part no., Item Description, Op. Balance and Current Balance for a day or a date range. Inward and outward quantities are not typed here: they come from the Inward and Outward pages and are already inside the balance (Reports and the Excel export list them per part). Location and description are edited in place on a single day and save when the cell is left.
- **Descriptions come from the Parts master**: typing a part number on an inward entry, an outward invoice or *Add part* fills the description as soon as the number is complete; a part that reaches the ledger (inward entry, Add part, Excel import) takes the master's description, and a ledger part without a description is filled from the master. A description edited by hand on the ledger is kept.
- **Stock never goes below zero** through a new entry (the check covers the day and every later day). Negative balances that came in with the Excel history are shown in red and are not blocked.
- Quantities allow two decimals (hose lengths).
- **Import Excel** – a day sheet (Location, Part no., Item Description, Op. Balance, Inward, Outward) for one date, or the yearly workbook (sheets *Opening stock*, *Inward*, *Outward*) which replaces the whole ledger (admin only once data exists). Both show a preview first.
- **Reports** – stock summary, outward register, inward register, low stock; daily / weekly / monthly / yearly (financial year) / date range; Export Excel.
- **Low stock** (3 or less): the bell in the header (admin and stock users) lists a part from the moment a movement drops it to that level until it is back above it. No e-mail is sent.
- **Dashboard** – stock users get the stock dashboard, sales and viewers the quotation dashboard, admins both.

## Page access

**Administration → Page access** (admin only): for every page and every role (Sales, Stock, Viewer) choose **Hidden**, **View** (read only) or **Edit** (`src/lib/pageAccess.ts`). The menu, the request proxy (`src/proxy.ts`, page loads), every API action that changes data (`guardAccess` in `src/lib/api.ts`) and the screens (`useCan`) follow it; changes reach everyone within about 15 seconds. Always on: admins can do everything, the dashboard is open to all, Page access is for admins. On top of Edit a non-admin changes only their own quotations, only an admin deletes a sent quotation or a customer, and only an admin creates or changes an admin account. Cost data (BOM, landed costs, distributor discount) is shown to roles that can open a BOM page. Changes are recorded in the audit log.

## Audit log and drafts

- Every create / edit / delete is logged with **what changed** (field, before, after) – `src/lib/auditDiff.ts`. Sign-ins, file uploads and all stock actions are logged too. *Administration → Audit log* has filters, expandable rows and Excel export.
- A half-entered quotation, project quotation or BOM is kept in the browser (`src/lib/useDraft.ts`) and offered back with *Continue / Start fresh* when the form is opened again. Drafts are per user and per browser, and are dropped after 14 days.
- After changing a Mongoose model (`src/models`), restart `npm run dev` – the running dev server keeps the old model in memory.

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
