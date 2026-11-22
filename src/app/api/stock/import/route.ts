import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { applyDaySheet, applyHistory, parseStockWorkbook } from "@/lib/stockImport";
import { dayLabel, isDay, todayIST } from "@/lib/stockCalc";
import { StockItem } from "@/models/Stock";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** multipart: file, mode = preview | commit, date (day sheets), replace = 1 (yearly workbook over existing stock – admin).
    Preview never writes; it returns what the file holds and what would happen. */
export const POST = (req: NextRequest) => handle(async () => {
  const session = await guardAccess("stockLedger");
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an Excel file (.xlsx)." }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "The file is larger than 15 MB." }, { status: 400 });
  const commit = fd.get("mode") === "commit";
  let plan;
  try { plan = await parseStockWorkbook(await file.arrayBuffer()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message || "This file could not be read as an Excel workbook." }, { status: 400 }); }
  await dbConnect();
  const cap = <T,>(a: T[]) => a.slice(0, 300);

  if (plan.mode === "history") {
    const existing = await StockItem.estimatedDocumentCount();
    const report = { mode: plan.mode, stats: plan.stats, issues: cap(plan.issues), issueCount: plan.issues.length, existingParts: existing };
    if (!commit) return NextResponse.json({ report });
    if (existing > 0 && (fd.get("replace") !== "1" || session.user.role !== "admin")) {
      return NextResponse.json({ error: session.user.role === "admin" ? "The stock ledger already has data. Tick “Replace everything” to load this workbook over it." : "The stock ledger already has data. Only an admin can replace it with a yearly workbook." }, { status: 409 });
    }
    const done = await applyHistory(plan, { id: session.user.id, name: session.user.name ?? "" });
    await audit(session, "import", "stockImport", "-", `Stock history loaded from ${file.name}: ${done.parts} parts, ${plan.stats.inwardEntries} inward entries, ${plan.stats.outwardInvoices} outward invoices${existing ? ` (replaced ${existing} parts)` : ""}`);
    return NextResponse.json({ report, done });
  }

  const date = isDay(fd.get("date")) ? String(fd.get("date")) : todayIST();
  const res = await applyDaySheet(plan, date, commit);
  const report = { mode: plan.mode, date, stats: res.stats, issues: cap(res.issues), issueCount: res.issues.length };
  if (commit) await audit(session, "import", "stockImport", "-", `Day sheet ${dayLabel(date)} imported from ${file.name}: ${res.stats.added} new parts, ${res.stats.changed} rows changed, ${res.stats.skipped} skipped`);
  return NextResponse.json(commit ? { report, done: res.stats } : { report });
});
