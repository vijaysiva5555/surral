import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canStock } from "@/lib/roles";
import StockDocEditor from "../../StockDocEditor";

export default async function InwardPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const s = await getServerSession(authOptions);
  return <StockDocEditor type="in" id={params.id} canEdit={canStock(s?.user.role)} />;
}
