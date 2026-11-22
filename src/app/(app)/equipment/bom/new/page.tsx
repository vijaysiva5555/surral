import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import BomEditor from "../../../bom/BomEditor";

export default async function NewEquipmentBom() {
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("equipmentBom", "edit")) redirect("/equipment/bom");
  return <BomEditor userId={s!.user.id} category="equipment" basePath="/equipment/bom" />;
}
