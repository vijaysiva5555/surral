"use client";

export default function Pager({ page, pages, total, set }: { page: number; pages: number; total: number; set: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-center sm:text-left">{total.toLocaleString("en-IN")} results</span>
      <div className="flex items-center justify-center gap-2"><button className="btn-ghost !px-3 !py-1" disabled={page <= 1} onClick={() => set(page - 1)}>Prev</button><span className="tabular-nums">Page {page} / {Math.max(pages, 1)}</span><button className="btn-ghost !px-3 !py-1" disabled={page >= pages} onClick={() => set(page + 1)}>Next</button></div>
    </div>
  );
}
