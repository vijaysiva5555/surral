"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, LogIn } from "lucide-react";
import Tilt from "@/components/Tilt";
import { Backdrop, Cube } from "@/components/Scene3D";

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
    <main className="relative grid min-h-[100dvh] overflow-hidden bg-[#06182b] lg:grid-cols-[1.15fr_1fr]">
      <Backdrop />

      {/* ---- 3D scene (wide screens) ---- */}
      <section className="relative hidden flex-col justify-between p-10 text-white lg:flex xl:p-12">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sscpl-logo.png" alt="SSCPL" className="h-14 rounded-lg bg-white p-1 shadow-lg shadow-black/30" />
          <div className="text-lg font-semibold">Surral Surface Coatings</div>
        </div>

        <div className="scene-3d relative mx-auto my-6 h-[clamp(17rem,44vh,24rem)] w-full max-w-xl" aria-hidden>
          <Cube size={130} className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2" />
          <div className="float-card left-0 top-2 w-60" style={{ ["--base" as string]: "rotateY(18deg) rotateX(8deg)" }}>
            <div className="text-[11px] uppercase tracking-wider text-sky-200">Quotation</div>
            <div className="mt-1 font-semibold">SSCPL/SQ/0001</div>
            <div className="mt-3 space-y-1.5">{[90, 70, 80].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-white/30" style={{ width: `${w}%` }} />)}</div>
            <div className="mt-3 flex justify-between text-sm"><span className="text-sky-100">Total</span><span className="font-semibold">₹ 4,85,000</span></div>
          </div>
          <div className="float-card float-slow right-0 top-10 w-52" style={{ ["--base" as string]: "rotateY(-20deg) rotateX(6deg)" }}>
            <div className="text-[11px] uppercase tracking-wider text-sky-200">Stock ledger</div>
            <div className="mt-3 flex h-16 items-end gap-1.5">{[40, 65, 50, 85, 60, 95, 70].map((h, i) => <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand-500 to-sky-300" style={{ height: `${h}%` }} />)}</div>
            <div className="mt-2 text-xs text-sky-100">Inward · Outward · Balance</div>
          </div>
          <div className="float-card float-late bottom-0 left-1/2 w-64 -translate-x-1/2" style={{ ["--base" as string]: "translateX(-50%) rotateX(14deg)" }}>
            <div className="flex items-center justify-between"><span className="text-[11px] uppercase tracking-wider text-sky-200">Offer total</span><span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">Agreed</span></div>
            <div className="mt-1 text-2xl font-bold tracking-tight">₹ 14,15,000</div>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight">Quotations,<br /><span className="bg-gradient-to-r from-sky-300 to-brand-500 bg-clip-text text-transparent">done right.</span></h1>
          <p className="mt-4 max-w-md text-slate-300">Customers, Graco price lists, quotations, BOM and stock — all in one place.</p>
          <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
            Authorised Distributor for {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/graco-logo.png" alt="Graco" className="h-10 rounded-lg bg-white p-1" />
          </div>
        </div>
      </section>

      {/* ---- sign in ---- */}
      <section className="relative flex flex-col items-center justify-center gap-8 p-6">
        <div className="flex flex-col items-center gap-4 lg:hidden">
          <Cube size={72} />
          <div className="mt-4 text-center text-white">
            <div className="text-lg font-semibold">Surral Surface Coatings</div>
            <div className="text-sm text-slate-300">Quotation Manager</div>
          </div>
        </div>
        <Tilt className="login-card w-full max-w-sm" max={6}>
          <form onSubmit={submit} className="relative space-y-5 p-8" style={{ transform: "translateZ(30px)" }}>
            <div className="flex items-center gap-3">
              <span className="chip-3d h-11 w-11 from-sky-400 to-brand-600"><LogIn className="h-5 w-5" /></span>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
                <p className="text-sm text-slate-500">Use your Surral Quote account.</p>
              </div>
            </div>
            <div><label className="label">Email</label><input className="input" name="email" type="email" autoComplete="username" required autoFocus /></div>
            <div><label className="label">Password</label><input className="input" name="password" type="password" autoComplete="current-password" required /></div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" className="btn-primary w-full bg-gradient-to-b from-brand-500 to-brand-700 py-3 shadow-lg shadow-brand-600/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/40" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Signing in…" : "Sign in"}</button>
            <p className="text-center text-xs text-slate-400">Forgot your password? Ask your administrator to reset it.</p>
          </form>
        </Tilt>
      </section>
    </main>
  );
}
