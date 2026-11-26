import { redirect } from "next/navigation";

/** /project is a menu group, not a page of its own: it opens the group's quotation list */
export default function ProjectIndex() {
  redirect("/project/quotations");
}
