import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") redirect("/dashboard");
  return <UsersClient meId={session.user.id} />;
}
