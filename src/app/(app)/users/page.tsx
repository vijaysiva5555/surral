import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!(await sessionPerms()).can("users")) redirect("/dashboard");
  return <UsersClient meId={session!.user.id} />;
}
