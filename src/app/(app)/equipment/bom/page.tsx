import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import BomClient from "../../bom/BomClient";

export default async function EquipmentBomPage() {
  const s = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("equipmentBom")) redirect("/dashboard");
  return (
    <BomClient
      category="equipment"
      basePath="/equipment/bom"
      title="Equipment BOM packages"
      subtitle="Bills of materials with landed cost and margin for equipment quotations."
    />
  );
}
