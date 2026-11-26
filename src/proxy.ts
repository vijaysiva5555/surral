import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { canOpenPath, resolveAccess, type AccessMap } from "@/lib/pageAccess";

// Pages are protected here (redirect to /login). API routes are excluded on purpose: each one calls guard()
// and answers with a JSON 401/403, which is what fetch() callers expect.
//
// Every page load (also moving between pages inside the app) is checked against the page access the admin set on
// Administration → Page access; a page the role may not open sends the user to the dashboard. The map is fetched from
// /api/page-access and kept for a minute here (each page and API still checks access itself with a 15-second copy,
// so a page hidden by the admin is refused within seconds; this copy only saves a round trip on page loads).
let cache: { at: number; access: AccessMap } | null = null;
async function pageAccess(origin: string): Promise<AccessMap | null> {
  if (cache && Date.now() - cache.at < 60_000) return cache.access;
  try {
    const r = await fetch(`${origin}/api/page-access`, { cache: "no-store" });
    if (!r.ok) return cache?.access ?? null;
    cache = { at: Date.now(), access: resolveAccess((await r.json()).access) };
    return cache.access;
  } catch { return cache?.access ?? null; }   // settings not reachable: the page's own role checks still apply
}

export default withAuth(
  async function proxy(req) {
    const role = req.nextauth.token?.role as string | undefined;
    if (!role || role === "admin") return NextResponse.next();
    const access = await pageAccess(req.nextUrl.origin);
    if (access && !canOpenPath(access, role, req.nextUrl.pathname)) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  },
  { pages: { signIn: "/login" } },
);
export const config = { matcher: ["/((?!login|forgot|reset/|q/|pq/|api|_next|favicon.ico|.*\.(?:png|jpg|svg|ico)).*)"] };
