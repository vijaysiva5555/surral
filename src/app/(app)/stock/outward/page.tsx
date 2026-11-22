import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import StockDocsClient from "../StockDocsClient";

export default async function StockOutwardPage() {
  const s = await getServerSession(authOptions);
  return <StockDocsClient type="out" canEdit={(await sessionPerms()).can("stockOutward", "edit")} />;
}
