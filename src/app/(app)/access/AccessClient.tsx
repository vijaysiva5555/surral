"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, EyeOff, Eye, Info, Loader2, Lock, Pencil, RotateCcw, Save } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";
import { ACCESS_ROLES, PAGES, type AccessMap, type Level } from "@/lib/pageAccess";
import { ROLE_LABEL, type Role } from "@/lib/roles";

const groups = [...new Set(PAGES.map((p) => p.group))];
const OPTIONS: { level: Level; label: string; icon: typeof Eye; on: string }[] = [
  { level: "none", label: "Hidden", icon: EyeOff, on: "bg-slate-600 text-white" },
  { level: "view", label: "View", icon: Eye, on: "bg-sky-500 text-white" },
  { level: "edit", label: "Edit", icon: Pencil, on: "bg-emerald-600 text-white" },
];

/** Administration → Page access: for every page and every role – Hidden, View (read only) or Edit. */
export default function AccessClient() {
  const [access, setAccess] = useState<AccessMap | null>(null);
  const [saved, setSaved] = useState("");
  const [defaults, setDefaults] = useState<AccessMap | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    api("/api/page-access").then((r) => { setAccess(r.access); setSaved(JSON.stringify(r.access)); setDefaults(r.defaults); })
      .catch((e) => setMsg({ ok: false, t: (e as Error).message }));
  }, []);
  const dirty = !!access && JSON.stringify(access) !== saved;
  const counts = useMemo(() => Object.fromEntries(ACCESS_ROLES.map((r) => [r, {
    open: PAGES.filter((p) => (access?.[p.key]?.[r] ?? "none") !== "none").length,
    edit: PAGES.filter((p) => access?.[p.key]?.[r] === "edit").length,
  }])), [access]);

  if (!access) return <div className="py-20 text-center text-slate-400">{msg ? <p className="text-red-600">{msg.t}</p> : <Loader2 className="mx-auto h-6 w-6 animate-spin" />}</div>;

  const set = (key: string, role: Role, level: Level) => setAccess((a) => a && { ...a, [key]: { ...a[key], [role]: level } });
  /** a whole column at once; information-only pages get View when Edit is asked for */
  const setColumn = (role: Role, level: Level) => setAccess((a) => a && Object.fromEntries(PAGES.map((p) => [p.key, p.locked ? a[p.key] : { ...a[p.key], [role]: level === "edit" && !p.editable ? "view" : level }])));

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/api/page-access", { method: "PUT", json: { access } });
      setAccess(r.access); setSaved(JSON.stringify(r.access));
      setMsg({ ok: true, t: "Saved. It applies to everyone within about 15 seconds; users see their new menu when they reload the page." });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Page access" subtitle="For every page and role: Hidden, View (read only) or Edit">
        <button className="btn-ghost" disabled={busy || !defaults} onClick={() => defaults && setAccess(defaults)}><RotateCcw className="h-4 w-4" />Reset to default</button>
        <button className="btn-primary" disabled={busy || !dirty} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>
      </PageHeader>

      {msg && <p className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</p>}
      {dirty && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">You have unsaved changes.</p>}

      <div className="card-3d mb-4 flex items-start gap-3 p-4 text-sm text-slate-600">
        <span className="chip-3d h-9 w-9 from-sky-400 to-brand-600"><Info className="h-4 w-4" /></span>
        <div className="space-y-1">
          <p><b>Hidden</b> – not in the menu, and opening the address goes to the dashboard. <b>View</b> – opens read only. <b>Edit</b> – opens with its add, edit and delete tools; the server refuses changes from roles without Edit.</p>
          <p className="text-xs text-slate-500">Always on: admins can do everything, the dashboard is open to all, and Page access stays with admins. On top of Edit, a non-admin changes only their own quotations, only an admin deletes a sent quotation or a customer, and only an admin creates or changes an admin account. Cost data (BOM, landed costs, distributor discount) shows for roles that can open a BOM page.</p>
        </div>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="table-scroll">
          <table className="w-full !min-w-[52rem]">
            <thead>
              <tr>
                <th className="th">Page</th>
                <th className="th w-20 text-center">Admin</th>
                {ACCESS_ROLES.map((r) => (
                  <th key={r} className="th w-48 text-center">
                    <div>{ROLE_LABEL[r]}</div>
                    <div className="mt-1 flex justify-center gap-2 text-[10px] font-semibold normal-case tracking-normal">
                      <button type="button" className="text-emerald-700 hover:underline" onClick={() => setColumn(r, "edit")}>All edit</button>
                      <button type="button" className="text-sky-600 hover:underline" onClick={() => setColumn(r, "view")}>All view</button>
                      <button type="button" className="text-slate-500 hover:underline" onClick={() => setColumn(r, "none")}>None</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr><td colSpan={2 + ACCESS_ROLES.length} className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{g}</td></tr>
                  {PAGES.filter((p) => p.group === g).map((p) => (
                    <tr key={p.key} className="hover:bg-slate-50/60">
                      <td className="td">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">{p.label}{p.locked && <Lock className="h-3.5 w-3.5 text-slate-400" />}</div>
                        <div className="text-xs text-slate-400">{p.locked ? (p.locked === "view" ? "Always open to everyone" : "Admins only") : p.editable ? `Edit: ${p.editMeans}` : "Information only – View is the highest level"}</div>
                      </td>
                      <td className="td text-center"><span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600" title="Admins can do everything"><Check className="h-4 w-4" /></span></td>
                      {ACCESS_ROLES.map((r) => {
                        const now: Level = access[p.key]?.[r] ?? "none";
                        if (p.locked) return <td key={r} className="td text-center"><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500"><Lock className="h-3 w-3" />{OPTIONS.find((o) => o.level === p.locked)!.label}</span></td>;
                        return (
                          <td key={r} className="td text-center">
                            <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" role="radiogroup" aria-label={`${p.label}: ${ROLE_LABEL[r]}`}>
                              {OPTIONS.filter((o) => o.level !== "edit" || p.editable).map((o) => {
                                const Icon = o.icon, on = now === o.level;
                                return (
                                  <button key={o.level} type="button" role="radio" aria-checked={on} title={`${ROLE_LABEL[r]}: ${o.label}`} onClick={() => set(p.key, r, o.level)}
                                    className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium transition ${on ? o.on : "text-slate-500 hover:bg-slate-50"} [&:not(:first-child)]:border-l [&:not(:first-child)]:border-slate-200`}>
                                    <Icon className="h-3.5 w-3.5" />{o.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/70">
                <td className="td text-xs font-semibold text-slate-500">Pages each role can open · can edit</td>
                <td className="td text-center text-xs font-semibold text-slate-600">{PAGES.length}</td>
                {ACCESS_ROLES.map((r) => <td key={r} className="td text-center text-xs font-semibold text-slate-600">{counts[r].open} open · {counts[r].edit} edit</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
