"use client";
import { createContext, useContext } from "react";
import type { Level, Perms } from "@/lib/pageAccess";

const Ctx = createContext<Perms>({});
export function PermsProvider({ perms, children }: { perms: Perms; children: React.ReactNode }) {
  return <Ctx.Provider value={perms}>{children}</Ctx.Provider>;
}
const rank = (l: Level | undefined) => (l === "edit" ? 2 : l === "view" ? 1 : 0);
/** can(key, "edit") – what the signed-in user's role may do on a page (Administration → Page access) */
export function useCan() {
  const perms = useContext(Ctx);
  return (key: string, need: "view" | "edit" = "view") => rank(perms[key]) >= rank(need);
}
