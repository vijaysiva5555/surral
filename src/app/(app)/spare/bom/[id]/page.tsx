import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BomEditor from "../../../bom/BomEditor";
import { canSell } from "@/lib/roles";

export default async function EditSpareBom(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const s = await getServerSession(authOptions);
  if (!canSell(s!.user.role)) redirect("/dashboard");
  return <BomEditor key={params.id} id={params.id} userId={s!.user.id} category="spare" basePath="/spare/bom" />;
}
