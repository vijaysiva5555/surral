"use client";
import { useEffect, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";

type U = { _id?: string; name: string; email: string; role: "admin" | "sales" | "viewer"; phone?: string; active: boolean; password?: string };
const ROLE_STYLE = { admin: "bg-purple-50 text-purple-700", sales: "bg-brand-50 text-brand-700", viewer: "bg-slate-100 text-slate-600" };

export default function UsersClient({ meId }: { meId: string }) {
  const [items, setItems] = useState<U[]>([]);
  const [form, setForm] = useState<U | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => setItems((await api("/api/users")).items);
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form) return;
    setBusy(true); setErr("");
    try {
      if (form._id) await api(`/api/users/${form._id}`, { method: "PUT", json: { name: form.name, role: form.role, phone: form.phone, active: form.active, password: form.password ?? "" } });
      else await api("/api/users", { json: form });
      setForm(null); load();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Who can sign in and what they can do">
        <button className="btn-primary" onClick={() => { setErr(""); setForm({ name: "", email: "", role: "sales", phone: "", active: true, password: "" }); }}><Plus className="h-4 w-4" />Add user</button>
      </PageHeader>
      <div className="card mb-4 p-4 text-sm text-slate-600">
        <b>Admin</b> – everything, including users, company and price lists. <b>Sales</b> – create and edit customers and quotations. <b>Viewer</b> – read only.
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Phone</th><th className="th">Role</th><th className="th">Status</th><th className="th w-20" /></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u._id} className="hover:bg-slate-50">
                <td className="td font-medium text-slate-900">{u.name}{u._id === meId && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td>
                <td className="td">{u.email}</td><td className="td">{u.phone || "—"}</td>
                <td className="td"><span className={`badge capitalize ${ROLE_STYLE[u.role]}`}>{u.role}</span></td>
                <td className="td"><span className={`badge ${u.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{u.active ? "Active" : "Inactive"}</span></td>
                <td className="td text-right"><button className="text-sm font-medium text-brand-600" onClick={() => { setErr(""); setForm({ ...u, password: "" }); }}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setForm(null)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{form._id ? "Edit user" : "New user"}</h2><button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-500" /></button></div>
            <div className="space-y-4">
              <div><label className="label">Full name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input" type="email" disabled={!!form._id} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Phone</label><input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label className="label">Role</label><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as U["role"] })}><option value="admin">Admin</option><option value="sales">Sales</option><option value="viewer">Viewer</option></select></div>
              </div>
              <div><label className="label">{form._id ? "New password (leave blank to keep)" : "Password"}</label><input className="input" type="password" autoComplete="new-password" value={form.password ?? ""} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              {form._id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Active</label>}
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
              <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
