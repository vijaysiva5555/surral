import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionPerms } from "@/lib/serverAccess";
import HsnClient from "./HsnClient";

export default async function HsnPage() {
  const s = await getServerSession(authOptions);
  return <HsnClient canEdit={(await sessionPerms()).can("hsn", "edit")} />;
}
