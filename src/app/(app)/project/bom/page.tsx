import { redirect } from "next/navigation";
import { sessionPerms } from "@/lib/serverAccess";
import BomClient from "../../bom/BomClient";

export default async function ProjectBomPage() {
  if (!(await sessionPerms()).can("projectBom")) redirect("/dashboard");
  return (
    <BomClient
      category="project"
      basePath="/project/bom"
      title="Project BOM packages"
      subtitle="BOM worksheets for project offers (landed cost & margin) – pick one on a project quotation to fill an offer."
    />
  );
}
