import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ProjectQuotationsClient from "./ProjectQuotationsClient";

export const dynamic = "force-dynamic";

export default async function ProjectQuotationsPage() {
  const s = await getServerSession(authOptions);
  const role = s?.user.role ?? "viewer";
  return <ProjectQuotationsClient role={role} />;
}
