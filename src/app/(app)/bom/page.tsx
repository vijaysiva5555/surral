import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BomClient from "./BomClient";

export default async function BomPage() {
  const s = await getServerSession(authOptions);
  if (s!.user.role === "viewer") redirect("/dashboard");   // BOMs contain landed cost and margins
  return <BomClient />;
}
