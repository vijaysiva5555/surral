import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, handle } from "@/lib/api";
import { audit, type AuditChange } from "@/lib/audit";
import { ACCESS_ROLES, PAGES, defaultAccess } from "@/lib/pageAccess";
import { getPageAccess, savePageAccess } from "@/lib/pageAccessStore";
import { ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** Which roles may open which page. Read without signing in: the request proxy asks on every page load, and the map
    holds no data – only page names and role names. */
export const GET = () => handle(async () => {
  return NextResponse.json({ access: await getPageAccess(), defaults: defaultAccess() });
});

const body = z.object({ access: z.record(z.string(), z.array(z.enum(["sales", "stock", "viewer"]))) });

/** admin: saves the page access; the audit log lists every role added to or taken off a page */
export const PUT = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin"]);
  const { access } = body.parse(await req.json());
  const before = await getPageAccess();
  const after = await savePageAccess(access, session.user.name ?? "");
  const changes: AuditChange[] = [];
  for (const p of PAGES) {
    const was = before[p.key] ?? [], now = after[p.key] ?? [];
    for (const r of ACCESS_ROLES) {
      if (was.includes(r) && !now.includes(r)) changes.push({ field: `${p.label} · ${ROLE_LABEL[r]}`, from: "Can open", to: "Hidden" });
      if (!was.includes(r) && now.includes(r)) changes.push({ field: `${p.label} · ${ROLE_LABEL[r]}`, from: "Hidden", to: "Can open" });
    }
  }
  if (changes.length) await audit(session, "update", "pageAccess", "pageAccess", `Page access changed (${changes.length} change${changes.length === 1 ? "" : "s"})`, changes);
  return NextResponse.json({ access: after });
});
