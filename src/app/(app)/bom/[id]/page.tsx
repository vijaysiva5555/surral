/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { Bom } from "@/models/Bom";

export default async function LegacyEditBom({ params }: { params: { id: string } }) {
  await dbConnect();
  const b: any = await Bom.findById(params.id).select("category").lean();
  if (!b) redirect("/equipment/bom");
  const base = b.category === "spare" ? "spare" : "equipment";
  redirect(`/${base}/bom/${params.id}`);
}
