import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import BomEditor from "../../../bom/BomEditor";

export default async function EditEquipmentBom(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("equipmentBom")) redirect("/dashboard");
  return <BomEditor key={params.id} id={params.id} userId={s!.user.id} category="equipment" basePath="/equipment/bom" />;
}
