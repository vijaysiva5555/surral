import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import HsnClient from "./HsnClient";
import { canSell } from "@/lib/roles";

export default async function HsnPage() {
  const s = await getServerSession(authOptions);
  return <HsnClient canEdit={canSell(s!.user.role)} />;
}
