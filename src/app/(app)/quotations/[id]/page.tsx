/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { Quote } from "@/models/Quote";

export default async function LegacyEditQuote(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await dbConnect();
  const q: any = await Quote.findById(params.id).select("category").lean();
  if (!q) redirect("/spare/quotations");
  const base = q.category === "equipment" ? "equipment" : "spare";
  redirect(`/${base}/quotations/${params.id}`);
}
