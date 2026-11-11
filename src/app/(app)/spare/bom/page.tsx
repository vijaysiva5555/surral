import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BomClient from "../../bom/BomClient";

export default async function SpareBomPage() {
  const s = await getServerSession(authOptions);
  if (s!.user.role === "viewer") redirect("/dashboard");
  return (
    <BomClient
      category="spare"
      basePath="/spare/bom"
      title="Spare BOM packages"
      subtitle="BOM worksheets for spare-part quotations (landed cost & margin)."
    />
  );
}
