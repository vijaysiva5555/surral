import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import QuoteEditor from "../QuoteEditor";

export default async function NewQuote() {
  const s = await getServerSession(authOptions);
  if (s!.user.role === "viewer") redirect("/quotations");
  return <QuoteEditor role={s!.user.role} userId={s!.user.id} />;
}
