import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import QuoteEditor from "../../../quotations/QuoteEditor";
import { canSell } from "@/lib/roles";

export default async function NewSpareQuote() {
  const s = await getServerSession(authOptions);
  if (!canSell(s!.user.role)) redirect("/spare/quotations");
  return (
    <QuoteEditor
      role={s!.user.role}
      userId={s!.user.id}
      category="spare"
      basePath="/spare/quotations"
      bomBasePath="/spare/bom"
    />
  );
}
