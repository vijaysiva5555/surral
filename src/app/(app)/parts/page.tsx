import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PartsAdmin from "./PartsAdmin";

export default async function PartsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") redirect("/dashboard");
  return <PartsAdmin />;
}
