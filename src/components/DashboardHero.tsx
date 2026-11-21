import { Backdrop, Cube } from "./Scene3D";

/** The dashboard's welcome banner: a dark 3D panel with the turning cube, the greeting, today's date and the quick actions. */
export default function DashboardHero({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl bg-[#06182b] text-white shadow-[0_30px_60px_-25px_rgba(6,24,43,0.6)]">
      <Backdrop />
      <div className="relative flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-sky-300">{today}</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-300">{subtitle}</p>}
          {children && <div className="hero-actions mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{children}</div>}
        </div>
        <Cube size={104} className="mx-auto hidden shrink-0 md:mr-10 md:block" />
      </div>
    </section>
  );
}
