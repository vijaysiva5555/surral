import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AccessClient from "./AccessClient";

export default async function PageAccessPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") redirect("/dashboard");
  return <AccessClient />;
}
