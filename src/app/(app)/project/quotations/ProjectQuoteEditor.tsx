/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileDown, Loader2, Plus, Save, Search, Share2, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { dmy, inr, inr0 } from "@/lib/format";
import { QUOTE_STATUS_PATCH, quoteStatusLabel } from "@/lib/quoteStatus";
import StatusBadge from "@/components/StatusBadge";
import {
  DEFAULT_EXCLUSIONS, DEFAULT_PROJECT_TERMS, defaultIntro, emptyOffer, projectTotals,
} from "@/lib/projectQuote";

type Role = "admin" | "sales" | "viewer";
type Item = { description: string; qty: string; unitPrice: number };
type Consist = { description: string; qty: string };
type Offer = { title: string; items: Item[]; consists: Consist[] };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function ProjectQuoteEditor({ id, role, userId }: { id?: string; role: Role; userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");

  const [company, setCompany] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [contact, setContact] = useState({ name: "", phone: "" });

  const [date, setDate] = useState(today());
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [signerEmail, setSignerEmail] = useState("");

  const [graco, setGraco] = useState("");
  const [surral, setSurral] = useState("");
  const [technicalTitle, setTechnicalTitle] = useState("");
  const [specs, setSpecs] = useState<{ label: string; value: string }[]>([]);
  const [offers, setOffers] = useState<Offer[]>([emptyOffer(1)]);
  const [exclusions, setExclusions] = useState(DEFAULT_EXCLUSIONS.join("\n"));
  const [terms, setTerms] = useState(DEFAULT_PROJECT_TERMS());

  const readOnly = role === "viewer" || (!!existing && role === "sales" && existing.createdBy !== userId);

  useEffect(() => {
    (async () => {
      try {
        const [co, mine, quote] = await Promise.all([api("/api/company"), api("/api/me"), id ? api(`/api/project-quotes/${id}`) : Promise.resolve(null)]);
        setCompany(co.item); setMe(mine.item);
        setSignerName((prev) => prev || mine.item?.name || "");
        setSignerPhone((prev) => prev || mine.item?.phone || "");
        setSignerEmail((prev) => prev || co.item?.email || "");
        if (quote) {
          const q = quote.item; setExisting(q);
          setCustomer({ _id: q.customerId, ...q.customer });
          setContact(q.customer?.contact ?? { name: "", phone: "" });
          setDate(String(q.date).slice(0, 10));
          setSubject(q.subject ?? ""); setIntro(q.intro ?? "");
          setPreparedBy(q.preparedBy ?? ""); setApprovedBy(q.approvedBy ?? "");
          setSignerName(q.signerName ?? ""); setSignerPhone(q.signerPhone ?? ""); setSignerEmail(q.signerEmail ?? "");
          setGraco((q.equipmentGraco ?? []).join("\n")); setSurral((q.equipmentSurral ?? []).join("\n"));
          setTechnicalTitle(q.technicalTitle ?? "");
          setSpecs((q.specs ?? []).map((s: any) => ({ label: s.label ?? "", value: s.value ?? "" })));
          setOffers((q.offers ?? []).length ? q.offers : [emptyOffer(1)]);
          setExclusions((q.exclusions ?? []).join("\n"));
          setTerms((q.terms ?? []).length ? q.terms : DEFAULT_PROJECT_TERMS());
          api(`/api/customers/${q.customerId}`).then((r) => setCustomer((prev: any) => (prev?._id === q.customerId ? { ...prev, contacts: r.item?.contacts ?? [] } : prev))).catch(() => {});
        }
      } catch (e) { setErr((e as Error).message); }
      setLoading(false);
    })();
  }, [id]);

  const totals = useMemo(() => projectTotals(offers, terms.find((t) => /tax/i.test(t.label))?.value || "GST 18% Extra"), [offers, terms]);

  function pickCustomer(c: any) {
    setCustomer(c);
    setContact(c.contacts?.[0] ? { name: c.contacts[0].name, phone: c.contacts[0].phone } : { name: "", phone: "" });
    if (!subject) {
      const s = `Quotation for ${c.name}`;
      setSubject(s);
      if (!intro) setIntro(defaultIntro(s));
    }
  }

  const setOffer = (i: number, patch: Partial<Offer>) => setOffers((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const setItem = (oi: number, ii: number, patch: Partial<Item>) => setOffers((os) => os.map((o, j) => (j !== oi ? o : { ...o, items: o.items.map((l, k) => (k === ii ? { ...l, ...patch } : l)) })));
  const setConsist = (oi: number, ci: number, patch: Partial<Consist>) => setOffers((os) => os.map((o, j) => (j !== oi ? o : { ...o, consists: o.consists.map((l, k) => (k === ci ? { ...l, ...patch } : l)) })));

  async function save() {
    setErr(""); setMsg("");
    if (!customer?._id) return setErr("Select a customer first.");
    if (!offers.some((o) => o.items.some((l) => l.description.trim()))) return setErr("Add at least one offer line with a description.");
    setSaving(true);
    try {
      const payload = {
        customerId: customer._id, contact, date, subject, intro,
        preparedBy: preparedBy || me?.name || "", approvedBy,
        signerName, signerPhone, signerEmail,
        equipmentGraco: lines(graco), equipmentSurral: lines(surral),
        technicalTitle, specs, offers, exclusions: lines(exclusions), terms,
      };
      if (existing) {
        const r = await api(`/api/project-quotes/${existing._id}`, { method: "PUT", json: payload });
        setExisting(r.item); setMsg("Saved.");
      } else {
        const r = await api("/api/project-quotes", { json: payload });
        router.replace(`/project/quotations/${r.item._id}`);
      }
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }

  async function setStatus(status: string) {
    try { await api(`/api/project-quotes/${existing._id}`, { method: "PATCH", json: { status } }); setExisting({ ...existing, status }); setMsg(`Marked as ${status}.`); }
    catch (e) { setErr((e as Error).message); }
  }

  async function share() {
    try {
      const r = await api(`/api/project-quotes/${existing._id}/share`, { method: "POST" });
      const url = `${location.origin}/pq/${r.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setMsg(`Share link copied: ${url}`);
    } catch (e) { setErr((e as Error).message); }
  }

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-slate-400" />;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/project/quotations" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{existing ? existing.number : "New project quotation"}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">{existing && <StatusBadge status={existing.status} />}{readOnly && <span>Read only</span>}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {existing && <a className="btn-ghost" href={`/api/project-quotes/${existing._id}/pdf?inline=1`} target="_blank"><FileDown className="h-4 w-4" />PDF</a>}
          {existing && !readOnly && <button className="btn-ghost" onClick={share}><Share2 className="h-4 w-4" />Share</button>}
          {existing && !readOnly && (
            <select className="input !w-32" value={existing.status} onChange={(e) => setStatus(e.target.value)}>
              {QUOTE_STATUS_PATCH.map((s) => <option key={s} value={s}>{quoteStatusLabel(s)}</option>)}
            </select>
          )}
          {!readOnly && <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>}
        </div>
      </div>

      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="mb-4 break-all rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}

      <fieldset disabled={readOnly} className="space-y-5">
        {/* offer details */}
        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Offer &amp; customer</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="label">Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="label">Prepared by</label><input className="input" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder={me?.name} /></div>
            <div><label className="label">Approved by</label><input className="input" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="e.g. B. Mushtaq Ali" /></div>
          </div>

          <div className="mt-4"><CustomerSearch onPick={pickCustomer} /></div>
          {customer && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-semibold">M/s. {customer.name}</div>
                <div className="text-slate-600">{(customer.addressLines ?? []).join(", ")}{customer.pincode && ` – ${customer.pincode}`}</div>
                <div className="mt-1 text-xs text-slate-500">GST: {customer.gstin || "—"}</div>
              </div>
              <div className="space-y-2">
                {customer.contacts?.length > 1 && (
                  <select
                    className="input"
                    value={Math.max(0, customer.contacts.findIndex((c: any) => c.name === contact.name && c.phone === contact.phone))}
                    onChange={(e) => { const c = customer.contacts[Number(e.target.value)]; setContact({ name: c.name, phone: c.phone }); }}
                  >
                    {customer.contacts.map((c: any, i: number) => <option key={i} value={i}>{[c.name, c.phone, c.designation].filter(Boolean).join(" · ") || `Contact ${i + 1}`}</option>)}
                  </select>
                )}
                <input className="input" placeholder="Kind Attn – name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                <input className="input" placeholder="Kind Attn – phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-4">
            <div><label className="label">Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quotation for Promix 2KS Automatic System" /></div>
            <div><label className="label">Opening paragraph</label><textarea className="input" rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="As discussed with you we offered for …" /></div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div><label className="label">Signed by</label><input className="input" value={signerName} onChange={(e) => setSignerName(e.target.value)} /></div>
            <div><label className="label">Signatory phone</label><input className="input" value={signerPhone} onChange={(e) => setSignerPhone(e.target.value)} /></div>
            <div><label className="label">Signatory e-mail</label><input className="input" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} /></div>
          </div>
        </section>

        {/* equipment */}
        <section className="card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Equipment details</h2>
          <p className="mb-4 text-xs text-slate-500">One item per line; printed in the two “Details” boxes on page one.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Graco equipment’s</label><textarea className="input font-mono text-xs" rows={6} value={graco} onChange={(e) => setGraco(e.target.value)} placeholder={"ProMix 2KS 1C, 1H & 1S\nMerkur Pump 48:1, 75cc"} /></div>
            <div><label className="label">Surral equipment’s</label><textarea className="input font-mono text-xs" rows={6} value={surral} onChange={(e) => setSurral(e.target.value)} placeholder={"SS Tanks\nMS Mounting Frame\nAccessories"} /></div>
          </div>
        </section>

        {/* technical */}
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[18rem] flex-1"><label className="label">Technical description title</label><input className="input" value={technicalTitle} onChange={(e) => setTechnicalTitle(e.target.value)} placeholder="ProMix 2KS Automatic Wall Panel System" /></div>
            <button type="button" className="btn-ghost" onClick={() => setSpecs([...specs, { label: "", value: "" }])}><Plus className="h-4 w-4" />Add spec</button>
          </div>
          <div className="space-y-2">
            {specs.length === 0 && <p className="text-sm text-slate-400">No specifications yet.</p>}
            {specs.map((sp, i) => (
              <div key={i} className="flex gap-2">
                <input className="input !w-56" placeholder="Label (Model - Series)" value={sp.label} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className="input" placeholder="Value (ProMix - 2KS)" value={sp.value} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
              </div>
            ))}
          </div>
        </section>

        {/* offers */}
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Offers</h2>
              <p className="text-xs text-slate-500">Each offer prints its own item table and “Graco Supply Consists of” list.</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setOffers([...offers, emptyOffer(offers.length + 1)])}><Plus className="h-4 w-4" />Add offer</button>
          </div>

          <div className="space-y-6">
            {offers.map((o, oi) => (
              <div key={oi} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <input className="input" value={o.title} placeholder={`${oi + 1}. Offer for …`} onChange={(e) => setOffer(oi, { title: e.target.value })} />
                  {offers.length > 1 && <button type="button" onClick={() => setOffers(offers.filter((_, j) => j !== oi))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem]">
                    <thead><tr><th className="th w-10">#</th><th className="th">Description</th><th className="th w-24">Qty</th><th className="th w-36">Unit price ₹</th><th className="th w-10" /></tr></thead>
                    <tbody>
                      {o.items.map((l, ii) => (
                        <tr key={ii}>
                          <td className="td text-center text-xs text-slate-500">{ii + 1}</td>
                          <td className="td"><input className="input !py-1" value={l.description} onChange={(e) => setItem(oi, ii, { description: e.target.value })} placeholder="Promix 2KS System for Primer" /></td>
                          <td className="td"><input className="input !py-1 text-center" value={l.qty} onChange={(e) => setItem(oi, ii, { qty: e.target.value })} /></td>
                          <td className="td"><input className="input !py-1 text-right tabular-nums" type="number" min={0} step="0.01" value={l.unitPrice || ""} onChange={(e) => setItem(oi, ii, { unitPrice: Number(e.target.value) })} /></td>
                          <td className="td text-center">
                            {o.items.length > 1 && <button type="button" onClick={() => setOffer(oi, { items: o.items.filter((_, j) => j !== ii) })}><Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="mt-2 text-sm font-medium text-brand-600" onClick={() => setOffer(oi, { items: [...o.items, { description: "", qty: "1 Set", unitPrice: 0 }] })}><Plus className="mr-1 inline h-3.5 w-3.5" />Add line</button>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Graco supply consists of</span>
                    <button type="button" className="text-sm font-medium text-brand-600" onClick={() => setOffer(oi, { consists: [...o.consists, { description: "", qty: "" }] })}><Plus className="mr-1 inline h-3.5 w-3.5" />Add item</button>
                  </div>
                  <div className="space-y-2">
                    {o.consists.map((c, ci) => (
                      <div key={ci} className="flex gap-2">
                        <input className="input !py-1" value={c.description} placeholder="Merkur Pump 48:1, 75cc" onChange={(e) => setConsist(oi, ci, { description: e.target.value })} />
                        <input className="input !w-24 !py-1 text-center" value={c.qty} placeholder="1 No" onChange={(e) => setConsist(oi, ci, { qty: e.target.value })} />
                        <button type="button" onClick={() => setOffer(oi, { consists: o.consists.filter((_, j) => j !== ci) })}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* exclusions + terms */}
        <section className="card p-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h2 className="mb-1 font-semibold text-slate-900">Exclusions</h2>
              <p className="mb-2 text-xs text-slate-500">One exclusion per line.</p>
              <textarea className="input font-mono text-xs" rows={8} value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Terms &amp; conditions</h2>
                <button type="button" className="text-sm font-medium text-brand-600" onClick={() => setTerms([...terms, { label: "", value: "" }])}><Plus className="mr-1 inline h-3.5 w-3.5" />Add term</button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {terms.map((tm, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-2">
                    <div className="flex items-center gap-2">
                      <input className="input !py-1 !w-44 text-xs font-semibold" value={tm.label} placeholder="Payment" onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      <button type="button" className="ml-auto" onClick={() => setTerms(terms.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
                    </div>
                    <textarea className="input mt-1 text-xs" rows={2} value={tm.value} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-600">Offer total</div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums text-slate-900">₹ {inr(totals.total)}</div>
              <div className="text-xs text-slate-500">{totals.words}</div>
            </div>
          </div>
        </section>
      </fieldset>
    </>
  );
}

function CustomerSearch({ onPick }: { onPick: (c: any) => void }) {
  const [q, setQ] = useState(""); const [res, setRes] = useState<any[]>([]); const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => api(`/api/customers?q=${encodeURIComponent(q)}`).then((r) => setRes(r.items.filter((c: any) => c.active !== false).slice(0, 8))).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      <label className="label">Customer</label>
      <Search className="absolute left-3 top-[2.15rem] h-4 w-4 text-slate-400" />
      <input className="input pl-9" placeholder="Search customer by name or GST…" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && res.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {res.map((c) => (
            <button key={c._id} type="button" className="block w-full border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-brand-50" onMouseDown={() => { onPick(c); setQ(""); setOpen(false); }}>
              <div className="text-sm font-medium text-slate-900">{c.name}</div>
              <div className="text-xs text-slate-500">{c.addressLines?.[c.addressLines.length - 1]} {c.gstin && `· ${c.gstin}`}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
