import { redirect } from "next/navigation";

/** /spare is a menu group, not a page of its own: it opens the group's quotation list */
export default function SpareIndex() {
  redirect("/spare/quotations");
}
