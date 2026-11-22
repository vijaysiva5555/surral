import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import StockDocsClient from "../StockDocsClient";

export default async function StockInwardPage() {
  const s = await getServerSession(authOptions);
  return <StockDocsClient type="in" canEdit={(await sessionPerms()).can("stockInward", "edit")} />;
}
