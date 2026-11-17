import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canStock } from "@/lib/roles";
import LedgerClient from "./LedgerClient";

export default async function StockLedgerPage() {
  const s = await getServerSession(authOptions);
  return <LedgerClient canEdit={canStock(s?.user.role)} isAdmin={s?.user.role === "admin"} />;
}
