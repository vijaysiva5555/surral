import { sessionPerms } from "@/lib/serverAccess";
import PartsAdmin from "./PartsAdmin";

/** What a role may do here comes from Administration → Page access. The distributor (cost) discount is shown to whoever
    may see a BOM page – the roles that see cost data. */
export default async function PartsPage() {
  const { can } = await sessionPerms();
  return <PartsAdmin canEdit={can("parts", "edit")} showCost={can("equipmentBom") || can("spareBom")} />;
}
