import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import StockDocEditor from "../../StockDocEditor";

export default async function NewInwardPage() {
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("stockInward", "edit")) redirect("/stock/inward");
  return <StockDocEditor type="in" canEdit />;
}
