import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BomEditor from "../../../bom/BomEditor";
import { canSell } from "@/lib/roles";

export default async function NewSpareBom() {
  const s = await getServerSession(authOptions);
  if (!canSell(s!.user.role)) redirect("/dashboard");
  return <BomEditor userId={s!.user.id} category="spare" basePath="/spare/bom" />;
}
