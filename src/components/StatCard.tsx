import type { LucideIcon } from "lucide-react";

const TONES = {
  brand: { wrap: "bg-brand-50 text-brand-600", accent: "text-brand-600" },
  emerald: { wrap: "bg-emerald-50 text-emerald-600", accent: "text-emerald-600" },
  amber: { wrap: "bg-amber-50 text-amber-600", accent: "text-amber-600" },
  violet: { wrap: "bg-violet-50 text-violet-600", accent: "text-violet-600" },
  slate: { wrap: "bg-slate-100 text-slate-600", accent: "text-slate-600" },
} as const;

export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <div className="stat-card">
      <div className={`stat-icon ${t.wrap}`}>
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className={`mt-0.5 text-2xl font-bold tracking-tight text-slate-900`}>{value}</div>
        {sub && <div className={`mt-1 text-xs ${t.accent} opacity-80`}>{sub}</div>}
      </div>
    </div>
  );
}
