/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { X, Mail, Link2, Copy, Loader2, Check } from "lucide-react";
import { api } from "@/lib/client";
import { displayNumber } from "@/lib/quoteCalc";
import { dmy } from "@/lib/format";

/** Share link + e-mail for a saved quotation */
export default function SendModal({ quote, customer, contact, companyName, dirty, onClose, onSent }: { quote: any; customer: any; contact: { name: string; phone: string }; companyName: string; dirty: boolean; onClose: () => void; onSent: (status: string, emails: any[]) => void }) {
  const num = displayNumber(quote);
  const prefill = (customer?.contacts ?? []).find((c: any) => c.name === contact.name && c.email)?.email ?? (customer?.contacts ?? []).find((c: any) => c.email)?.email ?? "";
  const [mail, setMail] = useState<{ configured: boolean; mode: string } | null>(null);
  const [share, setShare] = useState<any>(null);
  const [to, setTo] = useState(prefill); const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Quotation ${num} – ${companyName}`);
  const [message, setMessage] = useState(`Dear ${contact.name || "Sir/Madam"},\n\nPlease find attached our quotation ${num} dated ${dmy(quote.date)}${quote.referredBy ? ` (ref: ${quote.referredBy})` : ""}. It is valid for ${quote.validityDays} days from the date of quotation.\n\nKindly let us know if you need any clarification.\n\nThanks & regards,\n${quote.preparedBy?.name ?? ""}${quote.preparedBy?.phone ? `\n${quote.preparedBy.phone}` : ""}\n${companyName}`);
  const [excel, setExcel] = useState(false); const [link, setLink] = useState(true);
  const [busy, setBusy] = useState(""); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [copied, setCopied] = useState(false);
  const [emails, setEmails] = useState<any[]>(quote.emails ?? []);

  useEffect(() => { api("/api/mail/status").then(setMail).catch(() => setMail({ configured: false, mode: "off" })); api(`/api/quotes/${quote._id}/share`).then(setShare).catch(() => {}); }, [quote._id]);

  async function makeLink() { setBusy("l"); try { setShare(await api(`/api/quotes/${quote._id}/share`, { method: "POST" })); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } setBusy(""); }
  async function stopLink() { if (!confirm("Switch off this link? Anyone who has it will no longer be able to open the quotation.")) return; setBusy("l"); try { setShare(await api(`/api/quotes/${quote._id}/share`, { method: "DELETE" })); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } setBusy(""); }
  async function copy() { try { await navigator.clipboard.writeText(share.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setMsg({ ok: false, t: "Copy failed – select the link and copy it manually." }); } }
  async function send() {
    setBusy("m"); setMsg(null);
    try { const r = await api(`/api/quotes/${quote._id}/email`, { json: { to, cc, subject, message, attachExcel: excel, includeLink: link } }); setEmails(r.emails); onSent(r.status, r.emails); setMsg({ ok: true, t: `Sent to ${to}.` }); api(`/api/quotes/${quote._id}/share`).then(setShare); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card flex max-h-[92vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="text-lg font-semibold">Send quotation {num}</h2><button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button></div>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {dirty && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">You have unsaved changes. Save the quotation first – the PDF and link use the saved version.</p>}

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-semibold"><Link2 className="h-4 w-4 text-brand-600" />Online link</h3>
            {share?.enabled ? (
              <div className="space-y-2">
                <div className="flex gap-2"><input readOnly className="input font-mono text-xs" value={share.url} onFocus={(e) => e.target.select()} /><button className="btn-ghost" onClick={copy}>{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button></div>
                <p className="text-xs text-slate-500">Opened {share.views} time{share.views === 1 ? "" : "s"}{share.lastViewedAt && ` · last ${new Date(share.lastViewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`} · valid until {dmy(share.expiresAt)} · <button className="font-medium text-red-600" onClick={stopLink} disabled={busy === "l"}>switch off</button></p>
              </div>
            ) : <button className="btn-ghost" onClick={makeLink} disabled={busy === "l" || dirty}>{busy === "l" && <Loader2 className="h-4 w-4 animate-spin" />}Create share link</button>}
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4 text-brand-600" />E-mail</h3>
            {mail && !mail.configured && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">E-mail is not set up on the server. Ask the administrator to add <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> and <code>MAIL_FROM</code> to the environment. You can still copy the link above.</p>}
            {mail?.mode === "file" && <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">Development mode: messages are saved in <code>.mail-outbox/</code> instead of being sent.</p>}
            <div className="grid gap-3 sm:grid-cols-2"><div><label className="label">To</label><input className="input" placeholder="name@company.com, other@company.com" value={to} onChange={(e) => setTo(e.target.value)} /></div><div><label className="label">Cc</label><input className="input" value={cc} onChange={(e) => setCc(e.target.value)} /></div></div>
            <div><label className="label">Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><label className="label">Message</label><textarea className="input" rows={9} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm"><span className="text-slate-500">Attached: PDF</span><label className="flex items-center gap-2"><input type="checkbox" checked={excel} onChange={(e) => setExcel(e.target.checked)} />Also attach Excel</label><label className="flex items-center gap-2"><input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} />Add online link to the message</label></div>
            {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</p>}
          </section>

          {emails.length > 0 && <section><h3 className="mb-2 text-sm font-semibold">Sent so far</h3><ul className="space-y-1 text-xs text-slate-500">{emails.map((m, i) => <li key={i}>{new Date(m.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · to {m.to} · by {m.by}</li>)}</ul></section>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-primary" disabled={busy === "m" || dirty || !mail?.configured || !to.trim()} onClick={send}>{busy === "m" && <Loader2 className="h-4 w-4 animate-spin" />}<Mail className="h-4 w-4" />Send e-mail</button></div>
      </div>
    </div>
  );
}
