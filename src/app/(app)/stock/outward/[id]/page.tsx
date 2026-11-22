import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import StockDocEditor from "../../StockDocEditor";

export default async function OutwardPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const s = await getServerSession(authOptions);
  return <StockDocEditor type="out" id={params.id} canEdit={(await sessionPerms()).can("stockOutward", "edit")} />;
}
