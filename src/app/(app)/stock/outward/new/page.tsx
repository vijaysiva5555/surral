import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import StockDocEditor from "../../StockDocEditor";

export default async function NewOutwardPage() {
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("stockOutward", "edit")) redirect("/stock/outward");
  return <StockDocEditor type="out" canEdit />;
}
