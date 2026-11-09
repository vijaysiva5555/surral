/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { X, Link2, Copy, Loader2, Check, FileDown } from "lucide-react";
import { api } from "@/lib/client";
import { displayNumber } from "@/lib/quoteCalc";
import { EXPORT_BLOCKED } from "@/lib/quoteApproval";
import { dmy } from "@/lib/format";

/** Private share link for a saved quotation (view online + download PDF, no login needed) */
export default function ShareModal({ quote, dirty, onClose }: { quote: any; dirty: boolean; onClose: () => void }) {
  const [share, setShare] = useState<any>(null); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false); const [err, setErr] = useState("");
  const exportOk = (quote.approvalStatus ?? "none") === "approved";
  useEffect(() => { if (exportOk) api(`/api/quotes/${quote._id}/share`).then(setShare).catch((e) => setErr(e.message)); }, [quote._id, exportOk]);

  async function call(method: "POST" | "DELETE") { setBusy(true); setErr(""); try { setShare(await api(`/api/quotes/${quote._id}/share`, { method })); } catch (e) { setErr((e as Error).message); } setBusy(false); }
  async function copy() { try { await navigator.clipboard.writeText(share.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setErr("Copy failed – select the link and copy it manually."); } }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="text-lg font-semibold">Share {displayNumber(quote)}</h2><button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button></div>
        <div className="space-y-5 p-6">
          {!exportOk && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{EXPORT_BLOCKED}</p>}
          {dirty && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">You have unsaved changes. Save first – the link shows the saved version.</p>}
          <section>
            <h3 className="mb-2 flex items-center gap-2 font-semibold"><Link2 className="h-4 w-4 text-brand-600" />Online link</h3>
            {share?.enabled ? (
              <div className="space-y-2">
                <div className="flex gap-2"><input readOnly className="input font-mono text-xs" value={share.url} onFocus={(e) => e.target.select()} /><button className="btn-ghost" onClick={copy}>{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button></div>
                <p className="text-xs text-slate-500">Opened {share.views} time{share.views === 1 ? "" : "s"}{share.lastViewedAt && ` · last ${new Date(share.lastViewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`} · valid until {dmy(share.expiresAt)}</p>
                <button className="text-sm font-medium text-red-600" onClick={() => confirm("Switch off this link? Anyone who has it will no longer be able to open the quotation.") && call("DELETE")} disabled={busy}>Switch off link</button>
              </div>
            ) : <button className="btn-primary" onClick={() => call("POST")} disabled={busy || dirty || !exportOk}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create share link</button>}
            <p className="mt-3 text-xs text-slate-500">Anyone with the link can view the quotation and download its PDF – paste it into WhatsApp or any message. Costing and cost prices are never shown.</p>
          </section>
          {exportOk && (
            <section className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <a className="btn-ghost" target="_blank" href={`/api/quotes/${quote._id}/pdf?inline=1`}><FileDown className="h-4 w-4" />Open PDF</a>
              <a className="btn-ghost" href={`/api/quotes/${quote._id}/pdf`}>Download PDF</a>
              <a className="btn-ghost" href={`/api/quotes/${quote._id}/excel`}>Download Excel</a>
            </section>
          )}
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        </div>
      </div>
    </div>
  );
}
