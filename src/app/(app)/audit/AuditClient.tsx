"use client";
import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Download, ExternalLink, Loader2, Search, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import { api } from "@/lib/client";
import { actionLabel, entityLabel, recordHref } from "@/lib/auditView";
import { ROLE_LABEL } from "@/lib/roles";
import { useDebouncedLoad } from "@/lib/useDebouncedLoad";

type Change = { field: string; from?: string; to?: string };
type A = { _id: string; at: string; userId?: string; userName?: string; role?: string; action: string; entity: string; entityId?: string; summary: string; changes?: Change[] };
type Meta = { users: { _id: string; name: string; email: string; active?: boolean }[]; entities: string[]; actions: string[] };
type Filters = { q: string; user: string; entity: string; action: string; from: string; to: string };

const NONE: Filters = { q: "", user: "", entity: "", action: "", from: "", to: "" };
const COLOR: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700", delete: "bg-red-50 text-red-700", status: "bg-amber-50 text-amber-700", update: "bg-brand-50 text-brand-700",
  "login-failed": "bg-red-50 text-red-700", login: "bg-slate-100 text-slate-600",
};
const noSub = () => () => {};
const byLabel = (list: string[], label: (s: string) => string) => [...list].sort((a, b) => label(a).localeCompare(label(b)));

export default function AuditClient() {
  const [f, setF] = useState<Filters>(NONE);
  const [page, setPage] = useState(1);
  const [d, setD] = useState<{ items: A[]; total: number; pages: number } | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const seq = useRef(0);

  const set = (k: keyof Filters, v: string) => { setF((p) => ({ ...p, [k]: v })); setPage(1); };
  const filtered = Object.values(f).some((v) => v.trim());
  // the viewer's clock, so the server reads the date filters as this browser shows them (India while the page is rendered on the server)
  const tz = useSyncExternalStore(noSub, () => new Date().getTimezoneOffset(), () => -330);
  // shared by the list and the Excel export
  const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)), tz: String(tz) }).toString();

  useEffect(() => { api<Meta>("/api/audit?meta=1").then(setMeta).catch(() => {}); }, []);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    try { const r = await api(`/api/audit?${query}&page=${page}`); if (n === seq.current) { setD(r); setErr(""); } }
    catch (e) { if (n === seq.current) setErr((e as Error).message); }
    if (n === seq.current) setLoading(false);
  }, [query, page]);
  useDebouncedLoad(load, [load]);

  const toggle = (id: string) => setOpen((p) => { const s = new Set(p); if (!s.delete(id)) s.add(id); return s; });
  const withChanges = d?.items.filter((a) => a.changes?.length) ?? [];
  const allOpen = withChanges.length > 0 && withChanges.every((a) => open.has(a._id));

  return (
    <>
      <PageHeader title="Audit log" subtitle="Who changed what, and when">
        {withChanges.length > 0 && <button className="btn-ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(withChanges.map((a) => a._id)))}>{allOpen ? "Hide all changes" : "Show all changes"}</button>}
        <a className="btn-ghost" href={`/api/audit/export?${query}`} title={filtered ? "Exports the entries matching the filters" : "Exports the whole log"}><Download className="h-4 w-4" />Export Excel</a>
      </PageHeader>

      {err && <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}<button onClick={() => setErr("")}><X className="h-4 w-4" /></button></div>}

      <div className="card overflow-hidden">
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Search details and changed values – quotation number, customer, part number…" value={f.q} onChange={(e) => set("q", e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input type="date" className="input min-w-0" aria-label="From date" title="From date" value={f.from} max={f.to || undefined} onChange={(e) => set("from", e.target.value)} />
              <span className="text-sm text-slate-400">to</span>
              <input type="date" className="input min-w-0" aria-label="To date" title="To date" value={f.to} min={f.from || undefined} onChange={(e) => set("to", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select className="input sm:flex-1" aria-label="Filter by user" value={f.user} onChange={(e) => set("user", e.target.value)}>
              <option value="">All users</option>
              {meta?.users.map((u) => <option key={u._id} value={u._id}>{u.name}{u.active === false ? " (inactive)" : ""}</option>)}
            </select>
            <select className="input sm:flex-1" aria-label="Filter by record type" value={f.entity} onChange={(e) => set("entity", e.target.value)}>
              <option value="">All record types</option>
              {byLabel(meta?.entities ?? [], entityLabel).map((e) => <option key={e} value={e}>{entityLabel(e)}</option>)}
            </select>
            <select className="input sm:flex-1" aria-label="Filter by action" value={f.action} onChange={(e) => set("action", e.target.value)}>
              <option value="">All actions</option>
              {byLabel(meta?.actions ?? [], actionLabel).map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
            </select>
            <button className="btn-ghost" disabled={!filtered} onClick={() => { setF(NONE); setPage(1); }}><X className="h-4 w-4" />Clear</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th w-10" /><th className="th hidden md:table-cell w-44">When</th><th className="th hidden w-40 xl:table-cell">User</th><th className="th hidden sm:table-cell w-32">Action</th><th className="th hidden w-36 xl:table-cell">Record</th><th className="th">Details</th><th className="th hidden sm:table-cell w-20" /></tr></thead>
            <tbody>
              {loading && !d && <tr><td colSpan={7} className="td text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {d?.items.map((a) => {
                const n = a.changes?.length ?? 0, isOpen = n > 0 && open.has(a._id), href = recordHref(a);
                return (
                  <Fragment key={a._id}>
                    <tr className={`${n ? "cursor-pointer" : ""} hover:bg-slate-50 ${isOpen ? "bg-slate-50/70" : ""}`} onClick={n ? () => toggle(a._id) : undefined}>
                      <td className="td !pr-0 text-slate-400">{n > 0 && <button aria-label={isOpen ? "Hide changes" : "Show changes"} aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); toggle(a._id); }}>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>}</td>
                      <td className="td hidden md:table-cell whitespace-nowrap text-xs text-slate-500">{new Date(a.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className="td hidden xl:table-cell"><div>{a.userName || "—"}</div>{a.role && <div className="text-xs text-slate-400">{(ROLE_LABEL as Record<string, string>)[a.role] ?? a.role}</div>}</td>
                      <td className="td hidden sm:table-cell"><span className={`badge whitespace-nowrap ${COLOR[a.action] ?? "bg-slate-100 text-slate-700"}`}>{actionLabel(a.action)}</span></td>
                      <td className="td hidden text-xs text-slate-500 xl:table-cell">{entityLabel(a.entity)}</td>
                      <td className="td"><span className="break-words">{a.summary}</span>{n > 0 && <span className="badge ml-2 whitespace-nowrap bg-slate-100 text-slate-600">{n} change{n === 1 ? "" : "s"}</span>}
                        <div className="mt-1 text-xs text-slate-400 xl:hidden"><span className="sm:hidden">{actionLabel(a.action)} · </span>{a.userName || "—"}<span className="md:hidden"> · {new Date(a.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></div></td>
                      <td className="td hidden sm:table-cell whitespace-nowrap text-right">
                        {href && (href.startsWith("/api/")
                          ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>View<ExternalLink className="h-3.5 w-3.5" /></a>
                          : <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>Open<ExternalLink className="h-3.5 w-3.5" /></Link>)}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td className="border-t border-slate-100 bg-slate-50/70" />
                        <td colSpan={6} className="border-t border-slate-100 bg-slate-50/70 px-4 pb-4 pt-1">
                          <table className="w-full table-fixed overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
                            <thead><tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500"><th className="w-[30%] px-3 py-2">Field</th><th className="w-[35%] px-3 py-2">Before</th><th className="w-[35%] px-3 py-2">After</th></tr></thead>
                            <tbody>
                              {a.changes!.map((c, i) => (
                                <tr key={i} className="border-t border-slate-100 align-top">
                                  <td className="break-words px-3 py-2 font-medium text-slate-700">{c.field}</td>
                                  <td className="break-words px-3 py-2 text-slate-500">{c.from ?? "—"}</td>
                                  <td className="break-words px-3 py-2 text-slate-900">{c.to ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {d?.items.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-slate-400">{filtered ? "No entries match these filters." : "No activity yet."}</td></tr>}
            </tbody>
          </table>
        </div>
        {d && <Pager page={page} pages={d.pages} total={d.total} set={setPage} />}
      </div>
    </>
  );
}
