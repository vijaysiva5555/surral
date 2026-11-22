"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, FileSignature, KeyRound, Loader2, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Backdrop } from "@/components/Scene3D";
import Tilt from "@/components/Tilt";
import SurralPerson from "@/components/SurralPerson";
import { api } from "@/lib/client";
import { ROLE_LABEL, type Role } from "@/lib/roles";

type Me = { name: string; email: string; phone: string; role: string };
type Note = { ok: boolean; t: string } | null;

const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
/** 0–4: length, mixed case, a digit, a symbol */
function strength(pw: string) {
  if (!pw) return 0;
  let s = pw.length >= 8 ? 1 : 0;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return pw.length < 8 ? Math.min(s, 1) : Math.max(s, 1);
}
const STRENGTH = [
  { label: "", bar: "bg-slate-200" },
  { label: "Weak", bar: "from-red-400 to-red-600" },
  { label: "Fair", bar: "from-amber-300 to-amber-500" },
  { label: "Good", bar: "from-sky-400 to-brand-600" },
  { label: "Strong", bar: "from-emerald-400 to-emerald-600" },
];

function PasswordInput({ value, onChange, autoComplete, show, onToggle }: { value: string; onChange: (v: string) => void; autoComplete: string; show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <input className="input pr-11" type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={onToggle} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700" aria-label={show ? "Hide password" : "Show password"} tabIndex={-1}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const note = (m: Note) => m && (
  <p className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${m.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
    {m.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{m.t}
  </p>
);

export default function ProfileClient() {
  const [me, setMe] = useState<Me | null>(null);
  const [saved, setSaved] = useState<{ name: string; phone: string } | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [show, setShow] = useState(false);
  const [m1, setM1] = useState<Note>(null); const [m2, setM2] = useState<Note>(null); const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    api("/api/me").then((r) => { const u = { phone: "", ...r.item }; setMe(u); setSaved({ name: u.name, phone: u.phone }); }).catch((e) => setErr((e as Error).message));
  }, []);
  if (err) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>;
  if (!me) return <div className="py-20 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  const changed = !!saved && (me.name.trim() !== saved.name || me.phone.trim() !== saved.phone);
  async function saveProfile() {
    setBusy("p"); setM1(null);
    try {
      const r = await api("/api/me", { method: "PUT", json: { name: me!.name, phone: me!.phone } });
      setSaved({ name: r.item.name, phone: r.item.phone ?? "" }); setMe((x) => (x ? { ...x, name: r.item.name, phone: r.item.phone ?? "" } : x));
      setM1({ ok: true, t: "Profile saved. Your name and phone are kept as “Prepared by” on quotations you create." });
    } catch (e) { setM1({ ok: false, t: (e as Error).message }); }
    setBusy("");
  }
  async function changePw() {
    setM2(null);
    if (pw.next !== pw.again) return setM2({ ok: false, t: "The two new passwords do not match." });
    setBusy("w");
    try { await api("/api/me/password", { json: { current: pw.current, next: pw.next } }); setPw({ current: "", next: "", again: "" }); setShow(false); setM2({ ok: true, t: "Password changed." }); }
    catch (e) { setM2({ ok: false, t: (e as Error).message }); }
    setBusy("");
  }
  const level = strength(pw.next);
  const role = ROLE_LABEL[me.role as Role] ?? me.role;
  const shownName = saved?.name || me.name;

  return (
    <>
      {/* ---- 3D identity banner ---- */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-[#06182b] text-white shadow-[0_30px_60px_-25px_rgba(6,24,43,0.6)]">
        <Backdrop />
        <div className="relative flex flex-col items-center gap-4 p-6 pb-0 text-center sm:flex-row sm:gap-6 sm:p-8 sm:pb-0 sm:text-left">
          {/* the animated Surral team member: first on a phone, on the right on wider screens */}
          <div className="relative order-first w-40 shrink-0 sm:order-last sm:ml-auto sm:w-48 lg:w-60">
            <div className="hello-bubble absolute -top-1 right-0 z-10 whitespace-nowrap rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 shadow-lg shadow-black/30 sm:right-auto sm:left-[62%]">Hi {(shownName.trim().split(/\s+/)[0] || "there")}! 👋</div>
            <Tilt className="rounded-3xl" max={10}><SurralPerson name={shownName} className="block w-full" /></Tilt>
          </div>
          <Tilt className="avatar-stage hidden shrink-0 rounded-full xl:flex" max={14}>
            <div className="orbit-ring" aria-hidden />
            <div className="orbit-ring orbit-ring-2" aria-hidden />
            <div className="avatar-3d">{initials(shownName)}</div>
          </Tilt>
          <div className="min-w-0 pb-6 sm:pb-8">
            <div className="text-xs font-medium uppercase tracking-wider text-sky-300">My profile</div>
            <h2 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">{shownName}</h2>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm sm:justify-start">
              <span className="glass-pill"><ShieldCheck className="h-4 w-4 text-emerald-300" />{role}</span>
              <span className="glass-pill max-w-full"><Mail className="h-4 w-4 shrink-0 text-sky-300" /><span className="truncate">{me.email}</span></span>
              {saved?.phone && <span className="glass-pill"><Phone className="h-4 w-4 text-sky-300" />{saved.phone}</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        {/* ---- details ---- */}
        <section className="card-3d space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="chip-3d h-10 w-10 from-sky-400 to-brand-600"><UserRound className="h-5 w-5" strokeWidth={1.75} /></span>
            <div><h2 className="font-semibold text-slate-900">Details</h2><p className="text-xs text-slate-500">Kept as “Prepared by” on quotations you create</p></div>
          </div>
          <div><label className="label" htmlFor="me-name">Full name</label><input id="me-name" className="input" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} /></div>
          <div><label className="label" htmlFor="me-phone">Phone</label><input id="me-phone" className="input" type="tel" inputMode="tel" value={me.phone} onChange={(e) => setMe({ ...me, phone: e.target.value })} /></div>
          {/* how the two fields print */}
          <div className="tile-3d flex items-center gap-3 bg-gradient-to-br from-slate-50 to-white px-4 py-3">
            <FileSignature className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} />
            <div className="min-w-0 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Prepared by – kept with your quotations (not printed)</div>
              <div className="truncate font-semibold text-slate-800">{me.name.trim() || "—"}{me.phone.trim() && <span className="font-normal text-slate-500"> · {me.phone.trim()}</span>}</div>
            </div>
          </div>
          {note(m1)}
          <button className="btn-primary bg-gradient-to-b from-brand-500 to-brand-700 shadow-lg shadow-brand-600/30 hover:-translate-y-0.5" disabled={busy === "p" || !changed} onClick={saveProfile}>{busy === "p" && <Loader2 className="h-4 w-4 animate-spin" />}Save profile</button>
        </section>

        {/* ---- password ---- */}
        <section className="card-3d space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="chip-3d h-10 w-10 from-violet-400 to-violet-600 [--chip-shadow:rgba(124,58,237,0.4)]"><KeyRound className="h-5 w-5" strokeWidth={1.75} /></span>
            <div><h2 className="font-semibold text-slate-900">Change password</h2><p className="text-xs text-slate-500">At least 8 characters</p></div>
          </div>
          <div><label className="label">Current password</label><PasswordInput value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} autoComplete="current-password" show={show} onToggle={() => setShow(!show)} /></div>
          <div>
            <label className="label">New password (8+ characters)</label>
            <PasswordInput value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} autoComplete="new-password" show={show} onToggle={() => setShow(!show)} />
            <div className="mt-2 flex items-center gap-3">
              <div className="grid flex-1 grid-cols-4 gap-1.5">{[1, 2, 3, 4].map((i) => <div key={i} className={`h-1.5 rounded-full shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)] ${i <= level ? `bg-gradient-to-r ${STRENGTH[level].bar}` : "bg-slate-200"}`} />)}</div>
              <span className="w-12 text-right text-xs font-medium text-slate-500">{STRENGTH[level].label}</span>
            </div>
          </div>
          <div>
            <label className="label">Repeat new password</label>
            <PasswordInput value={pw.again} onChange={(v) => setPw({ ...pw, again: v })} autoComplete="new-password" show={show} onToggle={() => setShow(!show)} />
            {pw.again && <p className={`mt-1.5 text-xs ${pw.again === pw.next ? "text-emerald-600" : "text-red-600"}`}>{pw.again === pw.next ? "Passwords match" : "Does not match the new password"}</p>}
          </div>
          {note(m2)}
          <button className="btn-primary bg-gradient-to-b from-violet-500 to-violet-700 shadow-lg shadow-violet-600/30 hover:-translate-y-0.5 hover:bg-violet-700" disabled={busy === "w" || !pw.current || pw.next.length < 8 || pw.next !== pw.again} onClick={changePw}>{busy === "w" && <Loader2 className="h-4 w-4 animate-spin" />}Change password</button>
        </section>
      </div>
    </>
  );
}
