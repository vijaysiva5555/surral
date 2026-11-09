import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import QuotationsClient from "./QuotationsClient";

export default async function QuotationsPage() {
  const s = await getServerSession(authOptions);
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading quotations…</div>}>
      <QuotationsClient role={s!.user.role} userId={s!.user.id} />
    </Suspense>
  );
}
