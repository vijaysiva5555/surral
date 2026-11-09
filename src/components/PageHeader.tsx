export default function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="page-toolbar">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="page-toolbar-actions">{children}</div>}
    </div>
  );
}
