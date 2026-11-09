"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";

export default function ProfileClient() {
  const [me, setMe] = useState<{ name: string; email: string; phone: string; role: string } | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [m1, setM1] = useState<{ ok: boolean; t: string } | null>(null); const [m2, setM2] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState("");
  useEffect(() => { api("/api/me").then((r) => setMe({ phone: "", ...r.item })); }, []);
  if (!me) return <Loader2 className="h-6 w-6 animate-spin text-slate-400" />;

  async function saveProfile() { setBusy("p"); setM1(null); try { await api("/api/me", { method: "PUT", json: { name: me!.name, phone: me!.phone } }); setM1({ ok: true, t: "Profile saved. Your name and phone print as “Prepared by” on new quotations." }); } catch (e) { setM1({ ok: false, t: (e as Error).message }); } setBusy(""); }
  async function changePw() {
    setM2(null); if (pw.next !== pw.again) return setM2({ ok: false, t: "The two new passwords do not match." });
    setBusy("w"); try { await api("/api/me/password", { json: { current: pw.current, next: pw.next } }); setPw({ current: "", next: "", again: "" }); setM2({ ok: true, t: "Password changed." }); } catch (e) { setM2({ ok: false, t: (e as Error).message }); } setBusy("");
  }
  const note = (m: { ok: boolean; t: string } | null) => m && <p className={`rounded-lg px-3 py-2 text-sm ${m.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{m.t}</p>;
  return (
    <>
      <PageHeader title="My profile" subtitle={`${me.email} · ${me.role}`} />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-6"><h2 className="font-semibold">Details</h2>
          <div><label className="label">Full name</label><input className="input" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={me.phone} onChange={(e) => setMe({ ...me, phone: e.target.value })} /></div>
          {note(m1)}<button className="btn-primary" disabled={busy === "p"} onClick={saveProfile}>{busy === "p" && <Loader2 className="h-4 w-4 animate-spin" />}Save profile</button></section>
        <section className="card space-y-4 p-6"><h2 className="font-semibold">Change password</h2>
          <div><label className="label">Current password</label><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div><label className="label">New password (8+ characters)</label><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          <div><label className="label">Repeat new password</label><input className="input" type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></div>
          {note(m2)}<button className="btn-primary" disabled={busy === "w"} onClick={changePw}>{busy === "w" && <Loader2 className="h-4 w-4 animate-spin" />}Change password</button></section>
      </div>
    </>
  );
}
