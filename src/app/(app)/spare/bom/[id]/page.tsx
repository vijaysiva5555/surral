import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BomEditor from "../../../bom/BomEditor";

export default async function EditSpareBom(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const s = await getServerSession(authOptions);
  if (s!.user.role === "viewer") redirect("/dashboard");
  return <BomEditor key={params.id} id={params.id} category="spare" basePath="/spare/bom" />;
}
