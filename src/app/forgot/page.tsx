"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client";

export default function ForgotPage() {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { setMsg((await api("/api/password/forgot", { json: { email } })).message); } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-8">
        <div><h1 className="text-2xl font-bold text-slate-900">Forgot password</h1><p className="text-sm text-slate-500">Enter your account e-mail and we’ll send a reset link.</p></div>
        {msg ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p> : (<>
          <div><label className="label">Email</label><input className="input" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Send reset link</button>
        </>)}
        <Link href="/login" className="block text-center text-sm font-medium text-brand-700">Back to sign in</Link>
      </form>
    </main>
  );
}
