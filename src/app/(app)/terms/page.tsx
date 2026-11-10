import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import TermsClient from "./TermsClient";

export default async function TermsPage() {
  const s = await getServerSession(authOptions);
  if (s?.user.role === "viewer") redirect("/dashboard");
  return <TermsClient />;
}
