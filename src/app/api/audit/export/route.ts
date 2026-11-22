/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { actionLabel, auditFilter, auditTz, entityLabel } from "@/lib/auditView";
import { ROLE_LABEL } from "@/lib/roles";
import { tableWorkbook, XLSX_TYPE } from "@/lib/xlsxExport";
import { AuditLog } from "@/models/AuditLog";

export const dynamic = "force-dynamic";
const MAX_ENTRIES = 20000, MAX_ROWS = 100000;

/** Excel copy of the audit log with the same filters as the page: one row per changed field (entries without a change list get one row) */
export const GET = (req: NextRequest) => handle(async () => {
  await guardAccess("audit", "view"); await dbConnect();
  const sp = req.nextUrl.searchParams, shift = -auditTz(sp) * 60000;   // Excel shows the stored time as it is, so move it to the viewer's clock
  const entries = await AuditLog.find(auditFilter(sp)).sort({ at: -1 }).limit(MAX_ENTRIES).lean<any[]>();
  const rows: Record<string, unknown>[] = [];
  for (const a of entries) {
    if (rows.length >= MAX_ROWS) break;
    const base = { at: a.at ? new Date(new Date(a.at).getTime() + shift) : null, u: a.userName, r: (ROLE_LABEL as Record<string, string>)[a.role] ?? a.role ?? "", a: actionLabel(a.action), e: entityLabel(a.entity), s: a.summary };
    const changes: any[] = a.changes?.length ? a.changes : [{}];
    for (const c of changes) rows.push({ ...base, f: c.field ?? "", b: c.from ?? "", n: c.to ?? "" });
  }
  const buf = await tableWorkbook("Audit log", [
    { header: "When", key: "at", width: 18, fmt: "dd-mmm-yyyy hh:mm" }, { header: "User", key: "u", width: 20 }, { header: "Role", key: "r", width: 10 }, { header: "Action", key: "a", width: 14 },
    { header: "Record type", key: "e", width: 16 }, { header: "Details", key: "s", width: 48 }, { header: "Field changed", key: "f", width: 34 }, { header: "Before", key: "b", width: 36 }, { header: "After", key: "n", width: 36 },
  ], rows);
  return new Response(buf as unknown as BodyInit, { headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="Audit_log_${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
});
