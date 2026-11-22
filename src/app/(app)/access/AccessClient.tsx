"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Info, Loader2, Lock, RotateCcw, Save, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";
import { ACCESS_ROLES, PAGES, type AccessMap } from "@/lib/pageAccess";
import { ROLE_LABEL, type Role } from "@/lib/roles";

const ROLE_NOTE: Record<Role, string> = {
  admin: "Always sees every page",
  sales: "Quotations, BOM, customers",
  stock: "Stock entries and ledger",
  viewer: "Read only",
};
const groups = [...new Set(PAGES.map((p) => p.group))];

/** Administration → Page access: which role may open which page. The menu and every page load follow it. */
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
  const counts = useMemo(() => Object.fromEntries(ACCESS_ROLES.map((r) => [r, PAGES.filter((p) => access?.[p.key]?.includes(r)).length])), [access]);

  if (!access) return <div className="py-20 text-center text-slate-400">{msg ? <p className="text-red-600">{msg.t}</p> : <Loader2 className="mx-auto h-6 w-6 animate-spin" />}</div>;

  const toggle = (key: string, role: Role) => setAccess((a) => {
    if (!a) return a;
    const now = a[key] ?? [];
    return { ...a, [key]: now.includes(role) ? now.filter((r) => r !== role) : [...now, role] };
  });
  const setColumn = (role: Role, on: boolean) => setAccess((a) => a && Object.fromEntries(PAGES.map((p) => {
    const now = a[p.key] ?? [];
    if (p.locked || !p.allowed.includes(role)) return [p.key, now];
    return [p.key, on ? [...new Set([...now, role])] : now.filter((r) => r !== role)];
  })));

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/api/page-access", { method: "PUT", json: { access } });
      setAccess(r.access); setSaved(JSON.stringify(r.access));
      setMsg({ ok: true, t: "Saved. Users see the change on their next page load (within about 15 seconds); the menu updates when they reload." });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Page access" subtitle="Choose which pages each role can open – the menu and every page follow it">
        <button className="btn-ghost" disabled={busy || !defaults} onClick={() => defaults && setAccess(defaults)}><RotateCcw className="h-4 w-4" />Reset to default</button>
        <button className="btn-primary" disabled={busy || !dirty} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>
      </PageHeader>

      {msg && <p className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</p>}
      {dirty && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">You have unsaved changes.</p>}

      <div className="card-3d mb-4 flex items-start gap-3 p-4 text-sm text-slate-600">
        <span className="chip-3d h-9 w-9 from-sky-400 to-brand-600"><Info className="h-4 w-4" /></span>
        <p>A hidden page disappears from that role’s menu, and opening its address takes the user to the dashboard. What a role may change on a page it can open stays as before (for example, viewers are always read only). Pages marked <Lock className="inline h-3.5 w-3.5" /> cannot be changed: admins always see everything, the dashboard is open to everyone, and BOM packages, terms and the admin pages are only built for the roles shown.</p>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="table-scroll">
          <table className="w-full !min-w-[40rem]">
            <thead>
              <tr>
                <th className="th">Page</th>
                {(["admin", ...ACCESS_ROLES] as Role[]).map((r) => (
                  <th key={r} className="th w-32 text-center">
                    <div>{ROLE_LABEL[r]}</div>
                    <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-400">{ROLE_NOTE[r]}</div>
                    {r !== "admin" && (
                      <div className="mt-1 flex justify-center gap-2 text-[10px] font-semibold normal-case tracking-normal">
                        <button type="button" className="text-brand-600 hover:underline" onClick={() => setColumn(r, true)}>All</button>
                        <button type="button" className="text-slate-500 hover:underline" onClick={() => setColumn(r, false)}>None</button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr><td colSpan={5} className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{g}</td></tr>
                  {PAGES.filter((p) => p.group === g).map((p) => (
                    <tr key={p.key} className="hover:bg-slate-50/60">
                      <td className="td">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">{p.label}{p.locked && <Lock className="h-3.5 w-3.5 text-slate-400" />}</div>
                        {p.note && <div className="text-xs text-slate-400">{p.note}</div>}
                      </td>
                      <td className="td text-center"><span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600" title="Admins always see every page"><Check className="h-4 w-4" /></span></td>
                      {ACCESS_ROLES.map((r) => {
                        const possible = p.allowed.includes(r), on = possible && (p.locked || (access[p.key] ?? []).includes(r));
                        if (!possible) return <td key={r} className="td text-center text-slate-300" title={`Not available for ${ROLE_LABEL[r]}`}>—</td>;
                        return (
                          <td key={r} className="td text-center">
                            <label className={`inline-flex ${p.locked ? "cursor-not-allowed" : "cursor-pointer"}`} title={p.locked ? "Fixed" : on ? `${ROLE_LABEL[r]} can open this page` : `Hidden from ${ROLE_LABEL[r]}`}>
                              <input type="checkbox" className="peer sr-only" checked={on} disabled={p.locked} onChange={() => toggle(p.key, r)} aria-label={`${p.label}: ${ROLE_LABEL[r]}`} />
                              <span className={`flex h-7 w-7 items-center justify-center rounded-lg border transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 ${on ? "border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/30" : "border-slate-300 bg-white text-transparent hover:border-brand-400"} ${p.locked ? "opacity-60" : ""}`}><Check className="h-4 w-4" /></span>
                            </label>
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
                <td className="td text-xs font-semibold text-slate-500"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Pages each role can open</td>
                <td className="td text-center text-xs font-semibold text-slate-600">{PAGES.length}</td>
                {ACCESS_ROLES.map((r) => <td key={r} className="td text-center text-xs font-semibold text-slate-600">{counts[r]}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
