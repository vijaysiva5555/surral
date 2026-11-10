import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import HsnClient from "./HsnClient";

export default async function HsnPage() {
  const s = await getServerSession(authOptions);
  return <HsnClient canEdit={s!.user.role !== "viewer"} />;
}
