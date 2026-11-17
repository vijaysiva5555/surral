import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canStock } from "@/lib/roles";
import StockDocEditor from "../../StockDocEditor";

export default async function NewInwardPage() {
  const s = await getServerSession(authOptions);
  if (!canStock(s?.user.role)) redirect("/stock/inward");
  return <StockDocEditor type="in" canEdit />;
}
