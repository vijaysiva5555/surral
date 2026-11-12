"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";
import { stateFromGstin, cleanGstin } from "@/lib/india";
import { uploadImage } from "@/lib/clientImage";
import { fileSrc } from "@/lib/fileUrl";

type C = { name: string; tagline: string; addressLines: string[]; gstin: string; phone: string; mobile: string; website: string; email: string; quotePrefix: string; quoteStartNo: number; logoData?: string; partnerLogoData?: string; bank: { name: string; branch: string; accountNo: string; ifsc: string } };
const empty: C = { name: "", tagline: "", addressLines: [], gstin: "", phone: "", mobile: "", website: "", email: "", quotePrefix: "SSCPL/SQ", quoteStartNo: 1, bank: { name: "", branch: "", accountNo: "", ifsc: "" } };

export default function CompanyForm() {
  const [c, setC] = useState<C | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/api/company").then((r) => setC({ ...empty, ...r.item, bank: { ...empty.bank, ...r.item?.bank } })); }, []);
  if (!c) return <Loader2 className="h-6 w-6 animate-spin text-slate-400" />;

  const f = (k: keyof Omit<C, "bank" | "addressLines">, label: string, ph = "") => (
    <div><label className="label">{label}</label><input className="input" placeholder={ph} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></div>
  );
  const st = stateFromGstin(cleanGstin(c.gstin));

  async function save() {
    setBusy(true); setMsg(null);
    try { await api("/api/company", { method: "PUT", json: c }); setMsg({ ok: true, text: "Company details saved." }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Company settings" subtitle="These details print in the header of every quotation">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</button>
      </PageHeader>
      {msg && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card space-y-4 p-6">
          <h2 className="font-semibold">Business details</h2>
          {f("name", "Company name")}
          {f("tagline", "Tagline / distributor line")}
          <div><label className="label">Address (one line per row)</label><textarea className="input" rows={3} value={c.addressLines.join("\n")} onChange={(e) => setC({ ...c, addressLines: e.target.value.split("\n") })} /></div>
          <div className="grid grid-cols-2 gap-4">{f("gstin", "GST number")}<div><label className="label">State (from GST)</label><input className="input" disabled value={st.state ? `${st.stateCode} · ${st.state}` : ""} /></div></div>
        </section>
        <section className="space-y-6">
          <div className="card space-y-4 p-6">
            <h2 className="font-semibold">Contact & numbering</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{f("phone", "Phone")}{f("mobile", "Mobile")}{f("website", "Website")}{f("email", "Email")}</div>
            <div className="grid grid-cols-2 gap-4">{f("quotePrefix", "Quote number prefix", "SSCPL/SQ")}
              <div><label className="label">Next quote no. starts at</label><input className="input" type="number" min={1} value={c.quoteStartNo} onChange={(e) => setC({ ...c, quoteStartNo: Number(e.target.value) })} /></div></div>
            <p className="text-xs text-slate-500">Quotes will be numbered <code>{c.quotePrefix || "…"}/&lt;no.&gt;/26-27</code> (financial year April–March).</p>
          </div>
          <div className="card space-y-4 p-6">
            <h2 className="font-semibold">Letterhead logos</h2>
            <div className="grid grid-cols-2 gap-4">
              {([["logoData", "Company logo (top left)", "/sscpl-logo.png"], ["partnerLogoData", "Partner logo (top right)", "/graco-logo.png"]] as const).map(([k, label, dflt]) => (
                <div key={k} className="space-y-2"><div className="label !mb-0">{label}</div>
                  <div className="grid h-24 place-items-center rounded-lg border border-slate-200 bg-white p-2"><img src={fileSrc(c[k]) || dflt} alt="" className="max-h-20 max-w-full object-contain" /></div>
                  <label className="btn-ghost cursor-pointer !py-1.5 text-xs">Upload<input type="file" accept="image/png,image/jpeg" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setMsg(null); try { const key = await uploadImage(f, "logo", 400, "image/png"); setC((x) => (x ? { ...x, [k]: key } : x)); } catch (err) { setMsg({ ok: false, text: (err as Error).message || "Could not upload that image." }); } } e.target.value = ""; }} /></label>
                  {c[k] && <button type="button" className="ml-2 text-xs text-red-600" onClick={() => setC({ ...c, [k]: "" })}>Use default</button>}</div>))}
            </div>
            <p className="text-xs text-slate-500">PNG or JPEG, stored in AWS S3. Used on every PDF, Excel and online quotation. Click “Save changes” to apply.</p>
          </div>
        </section>
      </div>
    </>
  );
}
