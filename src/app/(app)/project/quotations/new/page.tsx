import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ProjectQuoteEditor from "../ProjectQuoteEditor";
import { canSell } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function NewProjectQuote() {
  const s = await getServerSession(authOptions);
  if (!s?.user) redirect("/login");
  if (!canSell(s.user.role)) redirect("/project/quotations");
  return <ProjectQuoteEditor role={s.user.role} userId={s.user.id} />;
}
