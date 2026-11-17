import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BomClient from "../../bom/BomClient";
import { canSell } from "@/lib/roles";

export default async function EquipmentBomPage() {
  const s = await getServerSession(authOptions);
  if (!canSell(s!.user.role)) redirect("/dashboard");
  return (
    <BomClient
      category="equipment"
      basePath="/equipment/bom"
      title="Equipment BOM packages"
      subtitle="Bills of materials with landed cost and margin for equipment quotations."
    />
  );
}
