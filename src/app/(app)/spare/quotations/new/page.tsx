import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import QuoteEditor from "../../../quotations/QuoteEditor";

export default async function NewSpareQuote() {
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("spareQuotes", "edit")) redirect("/spare/quotations");
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
