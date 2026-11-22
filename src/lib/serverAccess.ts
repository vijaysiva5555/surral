import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { hasLevel, permsFor, type Perms } from "./pageAccess";
import { getPageAccess } from "./pageAccessStore";

/** the signed-in user's level on every page (for server-rendered pages) */
export async function sessionPerms() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const access = await getPageAccess();
  const perms: Perms = permsFor(access, session.user.role);
  const can = (key: string, need: "view" | "edit" = "view") => hasLevel(access, session.user.role, key, need);
  return { session, perms, can };
}

/** sends the user elsewhere unless their role has `need` on this page */
export async function requirePage(key: string, need: "view" | "edit" = "view", elsewhere = "/dashboard") {
  const r = await sessionPerms();
  if (!r.can(key, need)) redirect(elsewhere);
  return r;
}
