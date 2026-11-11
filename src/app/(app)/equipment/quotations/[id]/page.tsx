import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import QuoteEditor from "../../../quotations/QuoteEditor";

export default async function EditEquipmentQuote({ params }: { params: { id: string } }) {
  const s = await getServerSession(authOptions);
  return (
    <QuoteEditor
      key={params.id}
      id={params.id}
      role={s!.user.role}
      userId={s!.user.id}
      category="equipment"
      basePath="/equipment/quotations"
      bomBasePath="/equipment/bom"
    />
  );
}
