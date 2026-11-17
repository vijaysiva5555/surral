import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canStock } from "@/lib/roles";
import StockDocsClient from "../StockDocsClient";

export default async function StockOutwardPage() {
  const s = await getServerSession(authOptions);
  return <StockDocsClient type="out" canEdit={canStock(s?.user.role)} />;
}
