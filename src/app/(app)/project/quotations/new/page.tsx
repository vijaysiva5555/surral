import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import ProjectQuoteEditor from "../ProjectQuoteEditor";

export const dynamic = "force-dynamic";

export default async function NewProjectQuote() {
  const s = await getServerSession(authOptions);
  if (!s?.user) redirect("/login");
  if (!(await sessionPerms()).can("projectQuotes", "edit")) redirect("/project/quotations");
  return <ProjectQuoteEditor role={s.user.role} userId={s.user.id} />;
}
