import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canSell } from "@/lib/roles";
import PartsAdmin from "./PartsAdmin";

/** Every role may look parts up; only an admin adds, edits or deletes them. The distributor (cost) discount is shown
    to the sales side only – stock users and viewers never see cost data. */
export default async function PartsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user.role;
  return <PartsAdmin canEdit={role === "admin"} showCost={canSell(role)} />;
}
