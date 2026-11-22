import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import BomEditor from "../../../bom/BomEditor";

export default async function EditSpareBom(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("spareBom")) redirect("/dashboard");
  return <BomEditor key={params.id} id={params.id} userId={s!.user.id} category="spare" basePath="/spare/bom" />;
}
