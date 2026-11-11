import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import QuotationsClient from "../../quotations/QuotationsClient";

export default async function SpareQuotationsPage() {
  const s = await getServerSession(authOptions);
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading quotations…</div>}>
      <QuotationsClient
        role={s!.user.role}
        userId={s!.user.id}
        category="spare"
        basePath="/spare/quotations"
        title="Spare quotations"
        listSub="Sales quotations for parts & spares (SSCPL/SQ — e.g. 0001/26-27)"
      />
    </Suspense>
  );
}
