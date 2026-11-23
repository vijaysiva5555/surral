/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useCan } from "@/components/PermsContext";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, FileDown, FileText, Heading, ImagePlus, Layers, Loader2, Plus, Save, Search, Share2, Sparkles, Trash2, X } from "lucide-react";
import BomPicker from "@/components/BomPicker";
import { itemUnitPrice2 } from "@/lib/bomCalc";
import { uploadImage } from "@/lib/clientImage";
import { fileSrc } from "@/lib/fileUrl";
import { api } from "@/lib/client";
import { dmy, inr, inr0 } from "@/lib/format";
import { QUOTE_STATUS_PATCH, quoteStatusLabel } from "@/lib/quoteStatus";
import StatusBadge from "@/components/StatusBadge";
import {
  DEFAULT_EXCLUSIONS, DEFAULT_PROJECT_TERMS, MAX_OFFER_IMAGES, MAX_TECHNICALS, defaultIntro, emptyOffer, gstNoteOf, lineAmount, lineGross, offerFromBom, projectTotals, supplyLists, technicalsOf,
} from "@/lib/projectQuote";
import { PROJECT_DEMO } from "@/lib/projectDemo";
import { type Role } from "@/lib/roles";
import { draftKey, draftWhen, useDraft } from "@/lib/useDraft";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
const MAX_UPLOAD_MB = 15;

type Item = { description: string; qty: string; unitPrice: number; discountPct?: number };
type Consist = { description: string; qty: string; unitPrice?: number; heading?: boolean };
type Offer = {
  title: string; items: Item[]; consists: Consist[]; surralConsists?: Consist[]; images?: string[];
  gracoLabel?: string; gracoPrice?: number; surralLabel?: string; surralPrice?: number; bomId?: string | null; bomName?: string | null;
};
type ListKey = "consists" | "surralConsists";
type Spec = { label: string; value: string };
type Technical = { title: string; specs: Spec[]; image?: string | null };
const emptyTechnical = (): Technical => ({ title: "", specs: [{ label: "", value: "" }], image: null });
/** a file from public/ (the demo photos) handed to the normal upload */
async function publicFile(url: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], url.split("/").pop() ?? "image.jpg", { type: blob.type || "image/jpeg" });
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
// what an untouched new offer looks like – a draft is only kept once the form differs from this
const PRISTINE_OFFERS = JSON.stringify([emptyOffer(1)]), PRISTINE_TERMS = JSON.stringify(DEFAULT_PROJECT_TERMS()), PRISTINE_EXCLUSIONS = DEFAULT_EXCLUSIONS.join("\n");

export default function ProjectQuoteEditor({ id, role, userId }: { id?: string; role: Role; userId: string }) {
  const can = useCan();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);   // images still on their way to S3
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
  const [systemName, setSystemName] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [technicals, setTechnicals] = useState<Technical[]>([]);
  const [offers, setOffers] = useState<Offer[]>([emptyOffer(1)]);
  const [extras, setExtras] = useState<Item[]>([]);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [exclusions, setExclusions] = useState(DEFAULT_EXCLUSIONS.join("\n"));
  const [terms, setTerms] = useState(DEFAULT_PROJECT_TERMS());
  const [saved, setSaved] = useState("");   // the form as last loaded / saved, to tell unsaved changes

  // Edit on Project – Quotation (Administration → Page access); a non-admin edits only their own offers
  const readOnly = !can("projectQuotes", "edit") || (!!existing && role !== "admin" && existing.createdBy !== userId);

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
          setSystemName(q.systemName ?? ""); setCoverImage(q.coverImage ?? null);
          setTechnicals(technicalsOf(q).map((t) => ({ title: t.title ?? "", specs: (t.specs ?? []).map((x: any) => ({ label: x.label ?? "", value: x.value ?? "" })), image: t.image ?? null })));
          setOffers((q.offers ?? []).length ? q.offers.map((o: any, i: number) => ({ ...emptyOffer(i + 1), ...o, consists: o.consists ?? [], surralConsists: o.surralConsists ?? [] })) : [emptyOffer(1)]);
          setExtras(q.extras ?? []);
          setExclusions((q.exclusions ?? []).join("\n"));
          setTerms((q.terms ?? []).length ? q.terms : DEFAULT_PROJECT_TERMS());
          api(`/api/customers/${q.customerId}`).then((r) => setCustomer((prev: any) => (prev?._id === q.customerId ? { ...prev, contacts: r.item?.contacts ?? [] } : prev))).catch(() => {});
        }
      } catch (e) { setErr((e as Error).message); }
      setLoading(false);
    })();
  }, [id]);

  // ---- draft: the form is kept in this browser until Save, so leaving the page does not lose a half-entered offer ----
  const form = useMemo(() => ({ customer, contact, date, subject, intro, preparedBy, approvedBy, signerName, signerPhone, signerEmail, systemName, coverImage, graco, surral, technicals, offers, extras, exclusions, terms }),
    [customer, contact, date, subject, intro, preparedBy, approvedBy, signerName, signerPhone, signerEmail, systemName, coverImage, graco, surral, technicals, offers, extras, exclusions, terms]);
  const sig = useMemo(() => JSON.stringify({ ...form, customer: form.customer?._id ?? "" }), [form]);
  useEffect(() => { if (existing && !saved) setSaved(sig); }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!existing && saved !== "" && sig !== saved;
  // the signatory is pre-filled, so it does not count as something entered
  const hasContent = !!customer?._id || [subject, intro, preparedBy, approvedBy, graco, surral, systemName].some((x) => x.trim()) || technicals.length > 0 || extras.length > 0 || !!coverImage
    || exclusions !== PRISTINE_EXCLUSIONS || JSON.stringify(offers) !== PRISTINE_OFFERS || JSON.stringify(terms) !== PRISTINE_TERMS;
  const draft = useDraft({
    key: !loading && !readOnly && (id ? !!existing : true) ? draftKey("project", userId, id) : null,
    data: form, active: existing ? dirty : hasContent, baseUpdatedAt: existing?.updatedAt,
  });
  function restoreDraft() {
    const d = draft.pending?.data; if (!d) return;
    setCustomer(d.customer ?? null); setContact(d.contact ?? { name: "", phone: "" });
    setDate(d.date || today()); setSubject(d.subject ?? ""); setIntro(d.intro ?? "");
    setPreparedBy(d.preparedBy ?? ""); setApprovedBy(d.approvedBy ?? "");
    setSignerName(d.signerName ?? ""); setSignerPhone(d.signerPhone ?? ""); setSignerEmail(d.signerEmail ?? "");
    setGraco(d.graco ?? ""); setSurral(d.surral ?? ""); setSystemName(d.systemName ?? ""); setCoverImage(d.coverImage ?? null);
    // a draft saved before technical descriptions became a list carried one title + spec table
    const old = d as any;
    setTechnicals(d.technicals ?? (old.technicalTitle || old.specs?.length ? [{ title: old.technicalTitle ?? "", specs: old.specs ?? [], image: null }] : []));
    setOffers(d.offers?.length ? d.offers : [emptyOffer(1)]); setExtras(d.extras ?? []); setExclusions(d.exclusions ?? ""); setTerms(d.terms ?? []);
    draft.resolve(true); setErr(""); setMsg("Draft restored – press Save to keep it.");
  }

  const totals = useMemo(() => projectTotals(offers, gstNoteOf(terms), extras), [offers, terms, extras]);

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
  const setTech = (ti: number, patch: Partial<Technical>) => setTechnicals((ts) => ts.map((t, j) => (j === ti ? { ...t, ...patch } : t)));
  const setSpec = (ti: number, si: number, patch: Partial<Spec>) => setTechnicals((ts) => ts.map((t, j) => (j !== ti ? t : { ...t, specs: t.specs.map((x, k) => (k === si ? { ...x, ...patch } : x)) })));
  const moveTech = (ti: number, d: number) => setTechnicals((ts) => { const n = [...ts], k = ti + d; if (k < 0 || k >= n.length) return ts; [n[ti], n[k]] = [n[k], n[ti]]; return n; });
  const setExtra = (i: number, patch: Partial<Item>) => setExtras((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const setList = (oi: number, list: ListKey, next: Consist[]) => setOffer(oi, { [list]: next } as Partial<Offer>);

  // ---- project BOM packages: an offer is filled from a package (needs View on Project – BOM packages, which shows cost data) ----
  const canBom = can("projectBom");
  const [bomFor, setBomFor] = useState<number | null>(null);   // the offer to fill; offers.length = a new offer
  async function useBom(b: any) {
    const blankFirst = JSON.stringify(offers) === PRISTINE_OFFERS;   // only the untouched first offer: fill it instead of adding one
    const target = bomFor === null || bomFor >= offers.length ? (blankFirst ? 0 : offers.length) : bomFor;
    setBomFor(null); setErr("");
    const cur = offers[target];
    if (cur && !blankFirst && JSON.stringify(cur) !== JSON.stringify(emptyOffer(target + 1))
      && !confirm(`Replace the lines and supply lists of offer ${target + 1} with the BOM package “${b.name}”?`)) return;
    const filled = offerFromBom(b, target + 1, itemUnitPrice2);
    let photo: string[] = [];
    if (b.image) {   // the package photo goes on the offer like an uploaded image
      setUploading((n) => n + 1);
      try { const blob = await (await fetch(fileSrc(b.image)!)).blob(); photo = [await uploadImage(new File([blob], "bom.jpg", { type: blob.type || "image/jpeg" }), "offer")]; }
      catch { setErr("The BOM package photo could not be added – upload it on the offer if you need it."); }
      finally { setUploading((n) => n - 1); }
    }
    setOffers((os) => {
      const keep = os[target]?.images ?? [];
      const next = { ...filled, images: [...keep, ...photo].slice(0, MAX_OFFER_IMAGES) };
      return target >= os.length ? [...os, next] : os.map((o, j) => (j === target ? next : o));
    });
    setMsg(`Offer ${target + 1} filled from the BOM package “${b.name}” – check the prices, then press Save.`);
  }

  /** one picture (cover or technical description): checked, resized and uploaded to S3; returns the key */
  async function uploadOne(file: File | undefined): Promise<string | null> {
    if (!file) return null;
    setErr("");
    if (!IMAGE_TYPES.includes(file.type)) { setErr("Only image files (JPG, PNG, WebP, GIF) can be uploaded."); return null; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { setErr(`Images must be under ${MAX_UPLOAD_MB} MB.`); return null; }
    setUploading((n) => n + 1);
    try { return await uploadImage(file, "offer"); }
    catch (e) { setErr(`${file.name}: ${(e as Error).message || "could not be uploaded"}.`); return null; }
    finally { setUploading((n) => n - 1); }
  }

  /** fills the form with the company's Promix 2KS demo offer; its photos are uploaded like any other */
  async function loadDemo() {
    if (hasContent && !confirm("Replace what is in the form with the demo content?")) return;
    setLoadingDemo(true); setErr(""); setMsg("");
    try {
      const d = PROJECT_DEMO;
      const [cover, ...techImages] = await Promise.all([d.coverPhoto, ...d.technicals.map((t) => t.photo)].map(async (u) => { try { return await uploadImage(await publicFile(u), "offer"); } catch { return null; } }));
      setSubject(d.subject); setIntro(d.intro); setSystemName(d.systemName); setCoverImage(cover);
      if (!approvedBy) setApprovedBy(d.approvedBy);
      setGraco(d.equipmentGraco.join("\n")); setSurral(d.equipmentSurral.join("\n"));
      setTechnicals(d.technicals.map((t, i) => ({ title: t.title, specs: t.specs.map((x) => ({ ...x })), image: techImages[i] })));
      setOffers(d.offers.map((o) => ({ ...o, items: o.items.map((x) => ({ ...x })), consists: o.consists.map((x) => ({ ...x })), surralConsists: o.surralConsists.map((x) => ({ ...x })), images: [] })));
      setExtras(d.extras.map((x) => ({ ...x }))); setExclusions(d.exclusions.join("\n")); setTerms(d.terms.map((x) => ({ ...x })));
      setMsg(`Demo content loaded${techImages.some((x) => !x) || !cover ? " (some photos could not be uploaded)" : ""}. Choose the customer, then press Save – the Word download shows the full layout.`);
    } catch (e) { setErr((e as Error).message); }
    setLoadingDemo(false);
  }

  /** images only: each is checked, resized to ≤1400 px, uploaded to S3 and its key kept on the offer */
  async function addImages(oi: number, files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    const room = MAX_OFFER_IMAGES - (offers[oi].images?.length ?? 0);
    const picked = Array.from(files);
    const bad = picked.filter((f) => !IMAGE_TYPES.includes(f.type));
    const big = picked.filter((f) => IMAGE_TYPES.includes(f.type) && f.size > MAX_UPLOAD_MB * 1024 * 1024);
    const ok = picked.filter((f) => IMAGE_TYPES.includes(f.type) && f.size <= MAX_UPLOAD_MB * 1024 * 1024).slice(0, Math.max(0, room));
    const problems: string[] = [];
    if (bad.length) problems.push(`Only image files (JPG, PNG, WebP, GIF) can be uploaded – skipped ${bad.map((f) => f.name).join(", ")}.`);
    if (big.length) problems.push(`Images must be under ${MAX_UPLOAD_MB} MB – skipped ${big.map((f) => f.name).join(", ")}.`);
    if (picked.length - bad.length - big.length > ok.length) problems.push(`Up to ${MAX_OFFER_IMAGES} images per offer.`);
    setUploading((n) => n + ok.length);
    const keys: string[] = [];
    await Promise.all(ok.map(async (f) => {
      try { keys.push(await uploadImage(f, "offer")); }
      catch (e) { problems.push(`${f.name}: ${(e as Error).message || "could not be uploaded"}.`); }
      finally { setUploading((n) => n - 1); }
    }));
    if (keys.length) setOffers((os) => os.map((o, j) => (j === oi ? { ...o, images: [...(o.images ?? []), ...keys].slice(0, MAX_OFFER_IMAGES) } : o)));
    if (problems.length) setErr(problems.join(" "));
  }

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
        systemName, coverImage, equipmentGraco: lines(graco), equipmentSurral: lines(surral),
        technicalTitle: "", specs: [], technicals, offers, extras, exclusions: lines(exclusions), terms,
      };
      if (existing) {
        const r = await api(`/api/project-quotes/${existing._id}`, { method: "PUT", json: payload });
        setExisting(r.item); setSaved(sig); draft.clear(); setMsg("Saved.");
      } else {
        const r = await api("/api/project-quotes", { json: payload });
        draft.clear(true);
        router.replace(`/project/quotations/${r.item._id}`);
      }
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }

  async function setStatus(status: string) {
    try { await api(`/api/project-quotes/${existing._id}`, { method: "PATCH", json: { status } }); setExisting({ ...existing, status }); setMsg(`Marked as ${status}.`); }
    catch (e) { setErr((e as Error).message); return; }
    // the status change stamped the record: keep a draft of unsaved changes based on the version now saved
    api(`/api/project-quotes/${existing._id}`).then((r) => setExisting((p: any) => p && { ...p, updatedAt: r.item.updatedAt })).catch(() => {});
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
            <div className="flex items-center gap-2 text-xs text-slate-500">{existing && <StatusBadge status={existing.status} />}{dirty && <span className="font-medium text-amber-600">Unsaved changes</span>}{readOnly && <span>Read only</span>}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!existing && !readOnly && <button type="button" className="btn-ghost" onClick={loadDemo} disabled={loadingDemo || !!draft.pending} title="Fill the form with a complete sample offer (Promix 2KS)">{loadingDemo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Load demo content</button>}
          {existing && <a className="btn-ghost" href={`/api/project-quotes/${existing._id}/pdf?inline=1`} target="_blank"><FileDown className="h-4 w-4" />PDF</a>}
          {existing && <a className="btn-ghost" href={`/api/project-quotes/${existing._id}/docx`} title={dirty ? "Downloads the last saved version – press Save first to include your changes" : "Editable Word document (.docx)"}><FileText className="h-4 w-4" />Word</a>}
          {existing && !readOnly && <button className="btn-ghost" onClick={share}><Share2 className="h-4 w-4" />Share</button>}
          {existing && !readOnly && (
            <select className="input !w-32" value={existing.status} onChange={(e) => setStatus(e.target.value)}>
              {QUOTE_STATUS_PATCH.map((s) => <option key={s} value={s}>{quoteStatusLabel(s)}</option>)}
            </select>
          )}
          {!readOnly && <button className="btn-primary" onClick={save} disabled={saving || uploading > 0 || !!draft.pending} title={uploading ? "Wait for the images to finish uploading" : undefined}>{saving || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>}
        </div>
      </div>

      {draft.pending && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            {!existing ? `You have an unfinished project quotation from ${draftWhen(draft.pending.savedAt)}.`
              : draft.pending.baseUpdatedAt === existing.updatedAt ? `You have unsaved changes from ${draftWhen(draft.pending.savedAt)}.`
              : `You have unsaved changes from ${draftWhen(draft.pending.savedAt)}, but this quotation has been saved since then – the saved version is newer. Restoring and saving will replace it.`}
            {" "}Choose one to go on editing.
          </span>
          <span className="flex shrink-0 gap-2">
            <button type="button" className="btn-primary !py-1.5" onClick={restoreDraft}>{existing ? "Restore" : "Continue"}</button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => draft.resolve(false)}>{existing ? "Discard" : "Start fresh"}</button>
          </span>
        </div>
      )}
      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="mb-4 break-all rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}

      {/* locked until the user has decided about a found draft, so neither the draft nor new typing can be lost */}
      <fieldset disabled={readOnly || !!draft.pending} className="min-w-0 space-y-5">
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

        {/* cover page */}
        <section className="card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Cover page</h2>
          <p className="mb-4 text-xs text-slate-500">The first page of the Word document: logo, company name, “Designing, Drafting, Manufacturing, Installation and Commissioning of” the system below, and a large photo.</p>
          <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
            <div><label className="label">System offered</label><input className="input" value={systemName} onChange={(e) => setSystemName(e.target.value)} placeholder="Promix 2KS Automatic System" /></div>
            <div>
              <label className="label">Cover photo</label>
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {coverImage ? <img src={fileSrc(coverImage)} alt="Cover photo" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-slate-300" />}
                </div>
                {!readOnly && (
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="cursor-pointer font-medium text-brand-600">{coverImage ? "Change" : "Upload"}<input type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={async (e) => { const k = await uploadOne(e.target.files?.[0]); e.target.value = ""; if (k) setCoverImage(k); }} /></label>
                    {coverImage && <button type="button" className="text-left text-slate-500 hover:text-red-600" onClick={() => setCoverImage(null)}>Remove</button>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* technical descriptions */}
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Technical descriptions</h2>
              <p className="text-xs text-slate-500">One block per item: “TECHNICAL DESCRIPTION: - title”, the specification table and a photo beside it.</p>
            </div>
            {technicals.length < MAX_TECHNICALS && <button type="button" className="btn-ghost" onClick={() => setTechnicals([...technicals, emptyTechnical()])}><Plus className="h-4 w-4" />Add technical description</button>}
          </div>
          {technicals.length === 0 && <p className="text-sm text-slate-400">No technical descriptions yet.</p>}
          <div className="space-y-4">
            {technicals.map((tch, ti) => (
              <div key={ti} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">{ti + 1}.</span>
                  <input className="input min-w-[14rem] flex-1" value={tch.title} placeholder="ProMix 2KS Automatic Wall Panel System" onChange={(e) => setTech(ti, { title: e.target.value })} />
                  <button type="button" title="Move up" disabled={ti === 0} onClick={() => moveTech(ti, -1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" title="Move down" disabled={ti === technicals.length - 1} onClick={() => moveTech(ti, 1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" title="Remove" onClick={() => setTechnicals(technicals.filter((_, j) => j !== ti))} className="p-1"><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1fr_11rem]">
                  <div className="space-y-2">
                    {tch.specs.map((sp, si) => (
                      <div key={si} className="flex gap-2">
                        <input className="input !w-1/2 !py-1.5 text-sm" placeholder="Model - Series" value={sp.label} onChange={(e) => setSpec(ti, si, { label: e.target.value })} />
                        <input className="input !py-1.5 text-sm" placeholder="ProMix - 2KS" value={sp.value} onChange={(e) => setSpec(ti, si, { value: e.target.value })} />
                        <button type="button" onClick={() => setTech(ti, { specs: tch.specs.filter((_, j) => j !== si) })}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
                      </div>
                    ))}
                    <button type="button" className="text-sm font-medium text-brand-600" onClick={() => setTech(ti, { specs: [...tch.specs, { label: "", value: "" }] })}><Plus className="mr-1 inline h-3.5 w-3.5" />Add row</button>
                  </div>
                  <div>
                    <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {tch.image ? <img src={fileSrc(tch.image)} alt={`${tch.title} photo`} className="h-full w-full object-contain" /> : <ImagePlus className="h-6 w-6 text-slate-300" />}
                    </div>
                    {!readOnly && (
                      <div className="mt-1 flex justify-between text-sm">
                        <label className="cursor-pointer font-medium text-brand-600">{tch.image ? "Change photo" : "Upload photo"}<input type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={async (e) => { const k = await uploadOne(e.target.files?.[0]); e.target.value = ""; if (k) setTech(ti, { image: k }); }} /></label>
                        {tch.image && <button type="button" className="text-slate-500 hover:text-red-600" onClick={() => setTech(ti, { image: null })}>Remove</button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* offers */}
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Offers</h2>
              <p className="text-xs text-slate-500">Each offer prints on its own page: its item table, then the Graco and Surral supply lists, each with its sub-total line (1A, 1B).</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canBom && !readOnly && <button type="button" className="btn-ghost" onClick={() => setBomFor(offers.length)} title="Add an offer filled from a project BOM package"><Layers className="h-4 w-4" />Offer from BOM package</button>}
              <button type="button" className="btn-ghost" onClick={() => setOffers([...offers, emptyOffer(offers.length + 1)])}><Plus className="h-4 w-4" />Add offer</button>
            </div>
          </div>

          <div className="space-y-6">
            {offers.map((o, oi) => {
              const sums = supplyLists(o, oi);
              return (
              <div key={oi} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <input className="input" value={o.title} placeholder={`${oi + 1}. Offer for …`} onChange={(e) => setOffer(oi, { title: e.target.value })} />
                  {canBom && !readOnly && <button type="button" className="btn-ghost shrink-0 !px-3 !py-2 text-xs" onClick={() => setBomFor(oi)} title="Fill this offer from a project BOM package"><Layers className="h-4 w-4" />From BOM</button>}
                  {offers.length > 1 && <button type="button" aria-label="Remove offer" onClick={() => setOffers(offers.filter((_, j) => j !== oi))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>}
                </div>
                {o.bomName && <p className="-mt-1 mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700"><Layers className="h-3 w-3" />From BOM package: {o.bomName}</p>}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem]">
                    <thead><tr><th className="th w-10">#</th><th className="th">Description</th><th className="th w-24">Qty</th><th className="th w-36">Unit price ₹</th><th className="th w-20" title="Discount – shown in the OFFER TOTAL table">Dis %</th><th className="th w-32 text-right">Total ₹</th><th className="th w-10" /></tr></thead>
                    <tbody>
                      {o.items.map((l, ii) => (
                        <tr key={ii}>
                          <td className="td text-center text-xs text-slate-500">{ii + 1}</td>
                          <td className="td"><input className="input !py-1" value={l.description} onChange={(e) => setItem(oi, ii, { description: e.target.value })} placeholder="Oil Filling System" /></td>
                          <td className="td"><input className="input !py-1 text-center" value={l.qty} onChange={(e) => setItem(oi, ii, { qty: e.target.value })} /></td>
                          <td className="td"><input className="input !py-1 text-right tabular-nums" type="number" min={0} step="0.01" value={l.unitPrice || ""} onChange={(e) => setItem(oi, ii, { unitPrice: Number(e.target.value) })} /></td>
                          <td className="td"><input className="input !py-1 text-center tabular-nums" type="number" min={0} max={100} step="0.5" value={l.discountPct || ""} placeholder="0" onChange={(e) => setItem(oi, ii, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></td>
                          <td className="td text-right text-sm tabular-nums text-slate-700">
                            {inr(lineGross(l))}
                            {Number(l.discountPct) > 0 && <div className="text-xs text-emerald-700">after dis. {inr(lineAmount(l))}</div>}
                          </td>
                          <td className="td text-center">
                            {o.items.length > 1 && <button type="button" aria-label="Remove line" onClick={() => setOffer(oi, { items: o.items.filter((_, j) => j !== ii) })}><Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="mt-2 text-sm font-medium text-brand-600" onClick={() => setOffer(oi, { items: [...o.items, { description: "", qty: "1 Set", unitPrice: 0, discountPct: 0 }] })}><Plus className="mr-1 inline h-3.5 w-3.5" />Add line</button>

                <SupplyEditor title="Graco supply consists of" no={`${oi + 1}A`} defaultLabel="Graco Accessories" first={0} oi={oi}
                  list={o.consists} label={o.gracoLabel ?? ""} price={o.gracoPrice ?? 0} sum={sums.graco.list.reduce((t, x) => t + x.amount, 0)}
                  onList={(next) => setList(oi, "consists", next)} onLabel={(v) => setOffer(oi, { gracoLabel: v })} onPrice={(v) => setOffer(oi, { gracoPrice: v })}
                  placeholder="Husky 1050 AL Air Operated Double Diaphragm Pump" />
                <SupplyEditor title="Surral supply consists of" no={`${oi + 1}B`} defaultLabel="Surral Accessories" first={sums.graco.list.filter((x) => !x.heading).length} oi={oi}
                  list={o.surralConsists ?? []} label={o.surralLabel ?? ""} price={o.surralPrice ?? 0} sum={sums.surral.list.reduce((t, x) => t + x.amount, 0)}
                  onList={(next) => setList(oi, "surralConsists", next)} onLabel={(v) => setOffer(oi, { surralLabel: v })} onPrice={(v) => setOffer(oi, { surralPrice: v })}
                  placeholder="200L Barrel Platform with bottom Tray" />

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Images <span className="font-normal normal-case tracking-normal">({o.images?.length ?? 0}/{MAX_OFFER_IMAGES} · JPG, PNG, WebP or GIF){uploading > 0 && " · uploading…"}</span>
                    </span>
                    {!readOnly && (o.images?.length ?? 0) < MAX_OFFER_IMAGES && (
                      <label className="cursor-pointer text-sm font-medium text-brand-600">
                        <ImagePlus className="mr-1 inline h-3.5 w-3.5" />Upload images
                        <input type="file" accept={IMAGE_TYPES.join(",")} multiple hidden onChange={(e) => { addImages(oi, e.target.files); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                  {(o.images?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-400">No images. Uploaded images are stored in AWS S3 and print below this offer.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      {o.images!.map((src, gi) => (
                        <div key={gi} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fileSrc(src)} alt={`Offer ${oi + 1} image ${gi + 1}`} className="h-full w-full object-contain" />
                          {!readOnly && (
                            <button type="button" aria-label="Remove image" title="Remove image"
                              className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-500 shadow hover:text-red-600"
                              onClick={() => setOffer(oi, { images: o.images!.filter((_, j) => j !== gi) })}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </section>
        {bomFor !== null && <BomPicker category="project" bomBasePath="/project/bom" onPick={useBom} onClose={() => setBomFor(null)} />}

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
                <div><h2 className="font-semibold text-slate-900">Terms &amp; conditions</h2><p className="text-xs text-slate-500">One point per line; start a line with • for a sub-point. Taxes and Other print under the heading, Warranty on its own page.</p></div>
                <button type="button" className="text-sm font-medium text-brand-600" onClick={() => setTerms([...terms, { label: "", value: "" }])}><Plus className="mr-1 inline h-3.5 w-3.5" />Add term</button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {terms.map((tm, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-2">
                    <div className="flex items-center gap-2">
                      <input className="input !py-1 !w-44 text-xs font-semibold" value={tm.label} placeholder="Payment" onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      <button type="button" className="ml-auto" onClick={() => setTerms(terms.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
                    </div>
                    <textarea className="input mt-1 text-xs" rows={Math.min(10, Math.max(2, tm.value.split("\n").length + 1))} value={tm.value} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Offer total – further lines</h2>
                <p className="text-xs text-slate-500">Printed in the OFFER TOTAL table after the offers, e.g. Installation, Freight.</p>
              </div>
              <button type="button" className="text-sm font-medium text-brand-600" onClick={() => setExtras([...extras, { description: "", qty: "1 Set", unitPrice: 0, discountPct: 0 }])}><Plus className="mr-1 inline h-3.5 w-3.5" />Add line</button>
            </div>
            {extras.length === 0 ? <p className="text-xs text-slate-400">None.</p> : (
              <div className="space-y-2">
                {extras.map((x, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <input className="input !py-1 sm:flex-1" value={x.description} placeholder="Installation" onChange={(e) => setExtra(i, { description: e.target.value })} />
                    <input className="input !w-24 !py-1 text-center" value={x.qty} onChange={(e) => setExtra(i, { qty: e.target.value })} />
                    <input className="input !w-36 !py-1 text-right tabular-nums" type="number" min={0} step="0.01" value={x.unitPrice || ""} placeholder="Unit price ₹" onChange={(e) => setExtra(i, { unitPrice: Number(e.target.value) })} />
                    <input className="input !w-20 !py-1 text-center tabular-nums" type="number" min={0} max={100} step="0.5" value={x.discountPct || ""} placeholder="Dis %" title="Discount %" onChange={(e) => setExtra(i, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
                    <span className="w-28 text-right text-sm tabular-nums text-slate-600">₹ {inr(lineAmount(x))}</span>
                    <button type="button" onClick={() => setExtras(extras.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
                  </div>
                ))}
              </div>
            )}
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

/** one supply list of an offer: its sub-total line (1A / 1B), then the lines – with an optional price each – and group headings */
function SupplyEditor({ title, no, defaultLabel, first, oi, list, label, price, sum, onList, onLabel, onPrice, placeholder }: {
  title: string; no: string; defaultLabel: string; first: number; oi: number; list: Consist[]; label: string; price: number; sum: number;
  onList: (next: Consist[]) => void; onLabel: (v: string) => void; onPrice: (v: number) => void; placeholder: string;
}) {
  const set = (ci: number, patch: Partial<Consist>) => onList(list.map((c, k) => (k === ci ? { ...c, ...patch } : c)));
  let n = first;
  const amount = price > 0 ? price : sum;
  return (
    <div className="mt-5 rounded-lg bg-slate-50/70 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</span>
        <div className="flex gap-3">
          <button type="button" className="text-sm font-medium text-brand-600" onClick={() => onList([...list, { description: "", qty: "", heading: true }])} title="A heading inside the list, e.g. Husky 1050 AODD Pump Spares"><Heading className="mr-1 inline h-3.5 w-3.5" />Group heading</button>
          <button type="button" className="text-sm font-medium text-brand-600" onClick={() => onList([...list, { description: "", qty: "1 No", unitPrice: 0 }])}><Plus className="mr-1 inline h-3.5 w-3.5" />Add item</button>
        </div>
      </div>

      {/* the sub-total line printed above the list */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-2 py-1.5">
        <span className="w-10 shrink-0 text-center text-xs font-semibold text-slate-500">{no}</span>
        <input className="input !py-1 sm:flex-1" value={label} placeholder={defaultLabel} onChange={(e) => onLabel(e.target.value)} aria-label={`${no} description`} />
        <input className="input !w-36 !py-1 text-right tabular-nums" type="number" min={0} step="0.01" value={price || ""} placeholder={sum ? `${inr0(sum)} (lines)` : "Amount ₹"} onChange={(e) => onPrice(Number(e.target.value) || 0)} aria-label={`${no} amount`} title="Leave empty to use the total of the priced lines below" />
        <span className="w-full text-xs text-slate-400 sm:w-auto">{amount > 0 ? `prints as ${no} · 1 Set · ₹ ${inr(amount)}` : "not printed (no amount)"}</span>
      </div>

      <div className="space-y-2">
        {list.length === 0 && <p className="text-xs text-slate-400">None.</p>}
        {list.map((c, ci) => {
          const num = c.heading ? "" : c.description || c.qty ? `${oi + 1}.${++n}` : "–";
          return c.heading ? (
            <div key={ci} className="flex items-center gap-2">
              <Heading className="h-4 w-10 shrink-0 text-slate-400" />
              <input className="input !py-1 font-semibold" value={c.description} placeholder="Husky 1050 AODD Pump Spares" onChange={(e) => set(ci, { description: e.target.value })} aria-label="Group heading" />
              <button type="button" aria-label="Remove heading" onClick={() => onList(list.filter((_, j) => j !== ci))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
            </div>
          ) : (
            <div key={ci} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <span className="w-10 shrink-0 text-center text-xs text-slate-400">{num}</span>
              <input className="input !py-1 sm:flex-1" value={c.description} placeholder={placeholder} onChange={(e) => set(ci, { description: e.target.value })} />
              <input className="input !w-24 !py-1 text-center" value={c.qty} placeholder="1 No" onChange={(e) => set(ci, { qty: e.target.value })} />
              <input className="input !w-32 !py-1 text-right tabular-nums" type="number" min={0} step="0.01" value={c.unitPrice || ""} placeholder="Unit price ₹" title="Optional – a list with prices prints Unit Price and Total Price columns" onChange={(e) => set(ci, { unitPrice: Number(e.target.value) || 0 })} />
              <button type="button" aria-label="Remove item" onClick={() => onList(list.filter((_, j) => j !== ci))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
            </div>
          );
        })}
      </div>
    </div>
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
