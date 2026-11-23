import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import BomEditor from "../../../bom/BomEditor";

export default async function NewProjectBom() {
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("projectBom", "edit")) redirect("/project/bom");
  return <BomEditor userId={s!.user.id} category="project" basePath="/project/bom" />;
}
