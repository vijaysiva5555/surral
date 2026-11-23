import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

import type { Role } from "./roles";
export type { Role };

/** Returns the session, or throws a ready-made NextResponse for 401/403 */
export async function guard(roles?: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (roles && !roles.includes(session.user.role)) throw NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return session;
}

export function handle(fn: () => Promise<Response>) {
  return fn().catch((e) => {
    if (e instanceof Response) return e;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    if (err?.name === "ZodError") return NextResponse.json({ error: err.issues?.[0]?.message ?? "Invalid data" }, { status: 400 });
    if (err?.code === 11000) return NextResponse.json({ error: "Duplicate value (already exists)" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  });
}

/** Returns the session when the user's role has at least `need` on one of these pages (Administration → Page access);
    otherwise throws a ready-made 403. Admins always pass. Use it for every API action that changes data. */
export async function guardAccess(pages: string | string[], need: "view" | "edit" = "edit") {
  const session = await guard();
  if (session.user.role === "admin") return session;
  const [{ getPageAccess }, { hasLevel, PAGES }] = await Promise.all([import("./pageAccessStore"), import("./pageAccess")]);
  const access = await getPageAccess();
  const keys = [pages].flat();
  if (keys.some((k) => hasLevel(access, session.user.role, k, need))) return session;
  const label = PAGES.find((p) => p.key === keys[0])?.label ?? "this page";
  throw NextResponse.json({ error: need === "edit" ? `You do not have permission to change ${label}. Ask an admin (Administration → Page access).` : `You do not have access to ${label}.` }, { status: 403 });
}

/** landed costs, distributor discounts and BOM contents go to whoever may see a BOM page */
export async function seesCost(session: { user: { role: string } }) {
  if (session.user.role === "admin") return true;
  const [{ getPageAccess }, { hasLevel }] = await Promise.all([import("./pageAccessStore"), import("./pageAccess")]);
  const access = await getPageAccess();
  const { BOM_PAGES } = await import("./pageAccess");
  return BOM_PAGES.some((k) => hasLevel(access, session.user.role, k, "view"));
}
