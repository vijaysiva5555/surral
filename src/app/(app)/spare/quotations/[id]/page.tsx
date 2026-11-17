import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import QuoteEditor from "../../../quotations/QuoteEditor";

export default async function EditSpareQuote(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const s = await getServerSession(authOptions);
  return (
    <QuoteEditor
      key={params.id}
      id={params.id}
      role={s!.user.role}
      userId={s!.user.id}
      category="spare"
      basePath="/spare/quotations"
      bomBasePath="/spare/bom"
    />
  );
}
