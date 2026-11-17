import { Loader2 } from "lucide-react";

/** Shown inside the app frame the moment a menu link is clicked, while the page is fetched – the sidebar and header stay put. */
export default function Loading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-400" role="status" aria-live="polite">
      <Loader2 className="h-7 w-7 animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}
