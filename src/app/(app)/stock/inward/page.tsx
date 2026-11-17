import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canStock } from "@/lib/roles";
import StockDocsClient from "../StockDocsClient";

export default async function StockInwardPage() {
  const s = await getServerSession(authOptions);
  return <StockDocsClient type="in" canEdit={canStock(s?.user.role)} />;
}
