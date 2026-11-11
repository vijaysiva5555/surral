import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import QuoteEditor from "../../../quotations/QuoteEditor";

export default async function NewEquipmentQuote() {
  const s = await getServerSession(authOptions);
  if (s!.user.role === "viewer") redirect("/equipment/quotations");
  return (
    <QuoteEditor
      role={s!.user.role}
      userId={s!.user.id}
      category="equipment"
      basePath="/equipment/quotations"
      bomBasePath="/equipment/bom"
    />
  );
}
