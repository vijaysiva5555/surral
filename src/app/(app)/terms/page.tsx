import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import TermsClient from "./TermsClient";
import { canSell } from "@/lib/roles";

export default async function TermsPage() {
  const s = await getServerSession(authOptions);
  if (!canSell(s?.user.role)) redirect("/dashboard");
  return <TermsClient />;
}
