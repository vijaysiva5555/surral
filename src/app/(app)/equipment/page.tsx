import { redirect } from "next/navigation";

/** /equipment is a menu group, not a page of its own: it opens the group's quotation list */
export default function EquipmentIndex() {
  redirect("/equipment/quotations");
}
