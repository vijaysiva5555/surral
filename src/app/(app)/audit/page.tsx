import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import AuditClient from "./AuditClient";

export default async function AuditPage() {
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("audit")) redirect("/dashboard");
  return <AuditClient />;
}
