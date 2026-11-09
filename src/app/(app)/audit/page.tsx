import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AuditClient from "./AuditClient";

export default async function AuditPage() {
  const s = await getServerSession(authOptions);
  if (s?.user.role !== "admin") redirect("/dashboard");
  return <AuditClient />;
}
