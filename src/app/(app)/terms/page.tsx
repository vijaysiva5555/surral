import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import TermsClient from "./TermsClient";

export default async function TermsPage() {
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("terms")) redirect("/dashboard");
  return <TermsClient />;
}
