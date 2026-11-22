import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import BomEditor from "../../../bom/BomEditor";

export default async function NewSpareBom() {
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("spareBom", "edit")) redirect("/spare/bom");
  return <BomEditor userId={s!.user.id} category="spare" basePath="/spare/bom" />;
}
