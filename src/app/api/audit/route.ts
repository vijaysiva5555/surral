import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { auditFilter } from "@/lib/auditView";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";
/** ?page=&user=&entity=&action=&from=&to=&q=&tz=  (see auditFilter) · ?meta=1 returns the choices for the filter drop-downs */
export const GET = (req: NextRequest) => handle(async () => {
  await guard(["admin"]);
  await dbConnect();
  const sp = req.nextUrl.searchParams;
  if (sp.get("meta")) {
    const [users, entities, actions] = await Promise.all([User.find().select("name email active").sort({ name: 1 }).lean(), AuditLog.distinct("entity"), AuditLog.distinct("action")]);
    return NextResponse.json({ users, entities: entities.filter(Boolean), actions: actions.filter(Boolean) });
  }
  const filter = auditFilter(sp);
  const page = Math.max(1, Number(sp.get("page")) || 1), limit = 50;
  const [total, items] = await Promise.all([AuditLog.countDocuments(filter), AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
  return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) });
});
