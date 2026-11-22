import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, handle } from "@/lib/api";
import { audit, type AuditChange } from "@/lib/audit";
import { ACCESS_ROLES, PAGES, defaultAccess, type Level } from "@/lib/pageAccess";
import { getPageAccess, savePageAccess } from "@/lib/pageAccessStore";
import { ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";
const WORD: Record<Level, string> = { none: "Hidden", view: "View", edit: "Edit" };

/** Who may do what on which page. Read without signing in: the request proxy asks on every page load, and the map
    holds no data – only page names, role names and levels. */
export const GET = () => handle(async () => {
  return NextResponse.json({ access: await getPageAccess(), defaults: defaultAccess() });
});

const level = z.enum(["none", "view", "edit"]);
const body = z.object({ access: z.record(z.string(), z.object({ sales: level.optional(), stock: level.optional(), viewer: level.optional() })) });

/** admin: saves the page access; the audit log lists every level that changed */
export const PUT = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin"]);
  const { access } = body.parse(await req.json());
  const before = await getPageAccess();
  const after = await savePageAccess(access, session.user.name ?? "");
  const changes: AuditChange[] = [];
  for (const p of PAGES) for (const r of ACCESS_ROLES) {
    const was = before[p.key]?.[r] ?? "none", now = after[p.key]?.[r] ?? "none";
    if (was !== now) changes.push({ field: `${p.label} · ${ROLE_LABEL[r]}`, from: WORD[was], to: WORD[now] });
  }
  if (changes.length) await audit(session, "update", "pageAccess", "pageAccess", `Page access changed (${changes.length} change${changes.length === 1 ? "" : "s"})`, changes);
  return NextResponse.json({ access: after });
});
