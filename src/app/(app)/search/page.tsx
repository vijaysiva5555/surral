import { Suspense } from "react";
import SearchClient from "./SearchClient";

export default function AdvancedSearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading search…</div>}>
      <SearchClient />
    </Suspense>
  );
}
