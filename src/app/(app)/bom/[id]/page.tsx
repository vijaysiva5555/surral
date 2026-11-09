import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BomEditor from "../BomEditor";

export default async function EditBom({ params }: { params: { id: string } }) {
  const s = await getServerSession(authOptions);
  if (s!.user.role === "viewer") redirect("/dashboard");
  return <BomEditor key={params.id} id={params.id} />;
}
