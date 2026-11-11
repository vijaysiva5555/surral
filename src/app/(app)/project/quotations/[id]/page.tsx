import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ProjectQuoteEditor from "../ProjectQuoteEditor";

export const dynamic = "force-dynamic";

export default async function ProjectQuoteDetail({ params }: { params: { id: string } }) {
  const s = await getServerSession(authOptions);
  if (!s?.user) redirect("/login");
  return <ProjectQuoteEditor id={params.id} role={s.user.role} userId={s.user.id} />;
}
