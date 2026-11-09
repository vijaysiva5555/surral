import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import QuoteEditor from "../QuoteEditor";

export default async function EditQuote({ params }: { params: { id: string } }) {
  const s = await getServerSession(authOptions);
  return <QuoteEditor key={params.id} id={params.id} role={s!.user.role} userId={s!.user.id} />;
}
