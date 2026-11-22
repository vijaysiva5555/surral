import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import LedgerClient from "./LedgerClient";

export default async function StockLedgerPage() {
  const s = await getServerSession(authOptions);
  return <LedgerClient canEdit={(await sessionPerms()).can("stockLedger", "edit")} isAdmin={s?.user.role === "admin"} />;
}
