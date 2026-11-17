"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    // Read what is in the boxes right now. A browser's saved password can fill them without telling React, which leaves
    // values kept in state empty on the first click.
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim(), password = String(form.get("password") ?? "");
    setBusy(true); setError("");
    const res = await signIn("credentials", { email, password, redirect: false }).catch(() => null);
    if (!res || res.error) {
      setBusy(false);
      setError(res ? "Incorrect email or password" : "Could not reach the server. Check your connection and try again.");
      return;
    }
    // The button stays busy until the next page replaces this one (it used to look idle while the dashboard loaded, which
    // invited a second click). A full page load, so the app starts with the new session and no remembered redirect to /login.
    const next = new URLSearchParams(window.location.search).get("callbackUrl") ?? "";
    const ownPage = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login");   // only a page of this app, never another site
    window.location.assign(ownPage ? next : "/dashboard");
  }

  return (
    <main className="grid min-h-screen bg-app lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-700 via-slate-900 to-slate-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sscpl-logo.png" alt="SSCPL" className="h-14 rounded bg-white p-1" />
          <div className="text-lg font-semibold">Surral Surface Coatings</div>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Quotations,<br />done right.</h1>
          <p className="mt-4 max-w-md text-slate-300">Customer master, yearly Graco price lists and professional sales quotations — all in one place.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          Authorised Distributor for {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/graco-logo.png" alt="Graco" className="h-10 rounded bg-white p-1" />
        </div>
      </section>

      <section className="flex items-center justify-center p-6 lg:bg-white/50">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-8 shadow-card-hover">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="text-sm text-slate-500">Use your Surral Quote account.</p>
          </div>
          <div><label className="label">Email</label><input className="input" name="email" type="email" autoComplete="username" required autoFocus /></div>
          <div><label className="label">Password</label><input className="input" name="password" type="password" autoComplete="current-password" required /></div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-center text-xs text-slate-400">Forgot your password? Ask your administrator to reset it.</p>
        </form>
      </section>
    </main>
  );
}
