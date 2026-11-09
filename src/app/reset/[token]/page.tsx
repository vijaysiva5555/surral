"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client";

export default function ResetPage({ params }: { params: { token: string } }) {
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (pw !== pw2) return setErr("The two passwords do not match.");
    setBusy(true);
    try { await api("/api/password/reset", { json: { token: params.token, password: pw } }); setDone(true); } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-8">
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        {done ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Password changed. You can sign in now.</p> : (<>
          <div><label className="label">New password</label><input className="input" type="password" minLength={8} required autoFocus value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div><label className="label">Repeat password</label><input className="input" type="password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save password</button>
        </>)}
        <Link href="/login" className="block text-center text-sm font-medium text-brand-700">Go to sign in</Link>
      </form>
    </main>
  );
}
