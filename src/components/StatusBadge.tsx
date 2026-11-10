import { quoteStatusLabel } from "@/lib/quoteStatus";

export const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700", sent: "bg-brand-50 text-brand-700", agree: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700", expired: "bg-amber-50 text-amber-700", superseded: "bg-purple-50 text-purple-700",
  won: "bg-emerald-50 text-emerald-700", accepted: "bg-emerald-50 text-emerald-700", lost: "bg-red-50 text-red-700",
};
export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLE[status] ?? STATUS_STYLE.draft}`}>{quoteStatusLabel(status)}</span>;
}
