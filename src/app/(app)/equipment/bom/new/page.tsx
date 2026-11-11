import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BomEditor from "../../../bom/BomEditor";

export default async function NewEquipmentBom() {
  const s = await getServerSession(authOptions);
  if (s!.user.role === "viewer") redirect("/dashboard");
  return <BomEditor category="equipment" basePath="/equipment/bom" />;
}
