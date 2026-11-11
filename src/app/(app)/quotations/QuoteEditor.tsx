/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowDown, ArrowUp, Trash2, Plus, Save, FileDown, FileSpreadsheet, Copy, GitBranch, Calculator, ImagePlus, Loader2, Search, Package, Wrench, RefreshCw, Send, Layers, ClipboardPaste, History } from "lucide-react";
import { api } from "@/lib/client";
import { stateFromGstin } from "@/lib/india";
import { blankLine, computeTotals, DEFAULT_TERMS, financialYear, lineTotal, lineUnit, supplyType, type QuoteLine, type Term } from "@/lib/quoteCalc";
import { dmy, inr, inr0 } from "@/lib/format";
import PartPicker from "@/components/PartPicker";
import QuotePreview from "@/components/QuotePreview";
import StatusBadge from "@/components/StatusBadge";
import ShareModal from "@/components/ShareModal";
import BomPicker from "@/components/BomPicker";
import { bomSummary, consistsOf } from "@/lib/bomCalc";
import { QUOTE_STATUS_PATCH, quoteStatusLabel } from "@/lib/quoteStatus";
import { previewQuoteNumber, type QuoteCategory } from "@/lib/quoteCategory";
import { lineKey, type LastPrice } from "@/lib/lastPrice";

type Role = "admin" | "sales" | "viewer";
type PL = { _id: string; year: number; name: string; effectiveFrom: string };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const pickList = (lists: PL[], date: string) => { const asc = [...lists].sort((a, b) => +new Date(a.effectiveFrom) - +new Date(b.effectiveFrom)); return ([...asc].reverse().find((l) => l.effectiveFrom.slice(0, 10) <= date) ?? asc[0])?._id ?? ""; };
const shortName = (n: string) => n.replace(/^M\/s\.?\s*/i, "").split(/[\s,]/)[0] || n;

async function resizeImage(file: File, max = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.85);
}

export default function QuoteEditor({
  id,
  role,
  userId,
  category,
  basePath,
  bomBasePath,
}: {
  id?: string;
  role: Role;
  userId: string;
  category: QuoteCategory;
  basePath: string;
  bomBasePath: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  const [lists, setLists] = useState<PL[]>([]); const [company, setCompany] = useState<any>(null); const [me, setMe] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [contact, setContact] = useState({ name: "", phone: "" });
  const [date, setDate] = useState(today()); const [validityDays, setValidityDays] = useState(30); const [referredBy, setReferredBy] = useState("");
  const [priceListId, setPriceListId] = useState(""); const [priceManual, setPriceManual] = useState(false);
  const [gstRate, setGstRate] = useState(18); const [taxType, setTaxType] = useState<"auto" | "intra" | "inter">("auto");
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [terms, setTerms] = useState<Term[]>([]); const [termsTouched, setTermsTouched] = useState(false);
  const [image, setImage] = useState<string | null>(null); const [imageCaption, setImageCaption] = useState("");
  const [bomFor, setBomFor] = useState<string | null>(null);
  const [hsnList, setHsnList] = useState<any[]>([]); const [templates, setTemplates] = useState<any[]>([]); const [showSend, setShowSend] = useState(false);
  const [saved, setSaved] = useState("");

  // ---- load ----
  useEffect(() => {
    (async () => {
      try {
        const [pl, co, mine, hs, tp, quote] = await Promise.all([api("/api/pricing/lists"), api("/api/company"), api("/api/me"), api("/api/hsn?limit=500").catch(() => ({ items: [] })), api("/api/terms").catch(() => ({ items: [] })), id ? api(`/api/quotes/${id}`) : Promise.resolve(null)]);
        setLists(pl.items); setCompany(co.item); setMe(mine.item); setHsnList(hs.items); setTemplates(tp.items);
        if (quote) {
          const q = quote.item; setExisting(q);
          setCustomer({ _id: q.customerId, ...q.customer }); setContact(q.customer?.contact ?? { name: "", phone: "" });
          // the quote keeps only the stamped contact; pull the customer's current contact list for the picker
          api(`/api/customers/${q.customerId}`).then((r) => setCustomer((prev: any) => (prev?._id === q.customerId ? { ...prev, contacts: r.item?.contacts ?? [] } : prev))).catch(() => {});
          setDate(q.date.slice(0, 10)); setValidityDays(q.validityDays ?? 30); setReferredBy(q.referredBy ?? "");
          setPriceListId(q.priceListId ?? pickList(pl.items, q.date.slice(0, 10))); setPriceManual(!!q.priceListId);
          setGstRate(q.gstRate ?? 18); setTaxType(q.taxType ?? "auto"); setLines(q.lines ?? []); setTerms(q.terms ?? []); setTermsTouched(true);
          setImage(q.image ?? null); setImageCaption(q.imageCaption ?? "");
        } else { setPriceListId(pickList(pl.items, today())); }
      } catch (e) { setErr((e as Error).message); }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => { if (!priceManual && lists.length) setPriceListId(pickList(lists, date)); }, [date, lists, priceManual]);

  const list = lists.find((l) => l._id === priceListId);
  const validThrough = useMemo(() => {
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(+d)) return "";
    d.setDate(d.getDate() + Math.max(1, validityDays));
    return d.toISOString().slice(0, 10);
  }, [date, validityDays]);
  const readOnly = role === "viewer" || (existing && role === "sales" && existing.createdBy !== userId) || existing?.status === "superseded";
  const contentLocked = readOnly;
  const supply = taxType === "auto" ? supplyType(company?.stateCode ?? existing?.company?.stateCode, customer?.stateCode) : taxType;
  const totals = useMemo(() => computeTotals(lines, gstRate, supply), [lines, gstRate, supply]);

  const payload = useMemo(() => ({ customerId: customer?._id ?? "", contact, date, validityDays, referredBy, priceListId: priceManual ? priceListId : priceListId || null, gstRate, taxType, lines, terms, image, imageCaption }),
    [customer, contact, date, validityDays, referredBy, priceListId, priceManual, gstRate, taxType, lines, terms, image, imageCaption]);
  useEffect(() => { if (existing && !saved) setSaved(JSON.stringify(payload)); }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- last price given to this customer, per line (Advanced search, inline) ----
  const [lastPrices, setLastPrices] = useState<Record<string, LastPrice>>({});
  // a stable string, so typing a price does not re-run the lookup — only a changed code / description does
  const lineKeys = useMemo(() => JSON.stringify([...new Set(lines.map(lineKey).filter(Boolean))].sort()), [lines]);
  useEffect(() => {
    if (!customer?._id || lineKeys === "[]") { setLastPrices({}); return; }
    let stale = false;
    const t = setTimeout(() => {
      api("/api/search/last-prices", { json: { customerId: customer._id, keys: JSON.parse(lineKeys), excludeQuoteId: existing?._id } })
        .then((r) => { if (!stale) setLastPrices(r.matches); }).catch(() => {});
    }, 400);
    return () => { stale = true; clearTimeout(t); };
  }, [customer?._id, lineKeys, existing?._id]);
  const dirty = !!existing && saved !== "" && JSON.stringify(payload) !== saved;

  const previewDoc = useMemo(() => {
    const co = existing?.company ?? company ?? {};
    return {
      number: existing?.number ?? previewQuoteNumber(co, financialYear(new Date(date + "T12:00:00Z")), existing?.category ?? category),
      revision: existing?.revision ?? 0,
      date, validityDays, referredBy, company: co, customer: customer ? { ...customer, contact } : {}, preparedBy: existing?.preparedBy ?? me, lines, terms, totals, image, imageCaption,
      logo: company?.logoData || undefined, partnerLogo: company?.partnerLogoData || undefined,
    };
  }, [existing, company, date, validityDays, referredBy, customer, contact, me, lines, terms, totals, image, imageCaption]);

  // ---- customer ----
  const fillTerms = (tpl: Term[], name: string): Term[] => tpl.map((t) => ({ label: t.label, value: t.value.replace(/\{customer\}/g, shortName(name)) }));

  /** applies the customer's price agreements / standard discount to Graco part lines (and undoes them when the customer changes) */
  async function priceForCustomer(cid: string, ls: QuoteLine[]) {
    const pns = ls.filter((l) => l.kind === "part" && l.code).map((l) => l.code);
    if (!pns.length) return { lines: ls, n: 0 };
    try {
      const r = await api("/api/agreements/resolve", { json: { customerId: cid, pns, date } });
      let n = 0;
      const out = ls.map((l) => {
        if (l.kind !== "part") return l;
        const m = r.matches[l.code];
        if (!m) return l.agreement ? { ...l, basicPrice: l.priceRef?.listPrice ?? l.basicPrice, discountPct: 0, agreement: undefined } : l;
        n++;
        return { ...l, ...(m.fixedPrice != null ? { basicPrice: m.fixedPrice, discountPct: 0 } : { discountPct: m.discountPct ?? 0, basicPrice: l.priceRef?.listPrice ?? l.basicPrice }), agreement: m.note };
      });
      return { lines: out, n };
    } catch { return { lines: ls, n: 0 }; }
  }
  async function chooseCustomer(c: any) {
    setCustomer(c); setContact(c.contacts?.[0] ? { name: c.contacts[0].name, phone: c.contacts[0].phone } : { name: "", phone: "" });
    if (!termsTouched || terms.length === 0) { const d = templates.find((t) => t.isDefault); setTerms(d ? fillTerms(d.terms, c.name) : DEFAULT_TERMS(shortName(c.name))); }
    const r = await priceForCustomer(c._id, lines);
    if (r.n) { setLines(r.lines); setOk(`Customer pricing applied to ${r.n} Graco part${r.n > 1 ? "s" : ""}.`); } else if (r.lines !== lines) setLines(r.lines);
  }

  // ---- lines ----
  const upd = (lid: string, p: Partial<QuoteLine>) => setLines((ls) => ls.map((l) => (l.id === lid ? { ...l, ...p } : l)));
  const move = (i: number, d: number) => setLines((ls) => { const a = [...ls]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const num = (v: string) => (v === "" ? 0 : Number(v));
  async function addPart(p: any) {
    let line: QuoteLine = { ...blankLine("part"), code: p.pn, description: p.desc, hsn: p.hsn ?? "", basicPrice: p.price ?? 0,
      costPrice: p.price != null && p.costDiscountPct != null ? Math.round(p.price * (1 - p.costDiscountPct / 100) * 100) / 100 : undefined,
      priceRef: p.price != null && list ? { pn: p.pn, pga: p.pga, year: list.year, listPrice: p.price } : undefined };
    if (customer?._id) line = (await priceForCustomer(customer._id, [line])).lines[0];
    setLines((ls) => [...ls, line]);
    if (p.price == null) setErr(`Part ${p.pn} has no price in the ${list?.year ?? "selected"} list – enter the price manually.`);
  }
  const staleParts = lines.filter((l) => l.priceRef && list && l.priceRef.year !== list.year);
  async function reprice() {
    if (!list) return;
    const next = await Promise.all(lines.map(async (l) => {
      if (!l.priceRef) return l;
      try {
        const r = await api(`/api/parts?q=${encodeURIComponent(l.priceRef.pn)}&limit=10&listIds=${list._id}`);
        const m = r.items.find((x: any) => x.pn === l.priceRef!.pn && x.pga === l.priceRef!.pga); const price = m?.prices?.[list._id];
        if (price == null) return l;
        return { ...l, basicPrice: price, priceRef: { ...l.priceRef, year: list.year, listPrice: price }, costPrice: m.costDiscountPct != null ? Math.round(price * (1 - m.costDiscountPct / 100) * 100) / 100 : l.costPrice };
      } catch { return l; }
    }));
    setLines(next); setOk(`Graco parts repriced from the ${list.year} list.`);
  }

  // ---- BOM packages ----
  /** copies a BOM into a package line: name, "Consists of" list, price and an internal snapshot for costing */
  function applyBom(lineId: string, b: any) {
    const s = bomSummary(b);
    const snap = { bomId: String(b._id), name: b.name, date: String(b.date).slice(0, 10), items: b.items };
    setLines((ls) => ls.map((l) => (l.id !== lineId ? l : { ...l, kind: "package", code: l.code || "Graco", description: !l.description.trim() || l.description === l.bom?.name ? b.name : l.description, basicPrice: s.price, costPrice: s.landed, subItems: consistsOf(b), bom: snap })));
    if (!image && b.image) setImage(b.image);
    setBomFor(null); setOk(`BOM “${b.name}” applied: ₹${inr0(s.price)}.`);
  }
  async function reloadBom(l: QuoteLine) {
    try { applyBom(l.id, (await api(`/api/bom/${l.bom!.bomId}`)).item); } catch (e) { setErr((e as Error).message === "BOM not found" ? "That BOM no longer exists – the quotation keeps its saved copy." : (e as Error).message); }
  }

  // ---- save & actions ----
  async function save() {
    setErr(""); setOk("");
    if (!customer?._id) return setErr("Select a customer first.");
    if (!lines.length) return setErr("Add at least one item.");
    setSaving(true);
    try {
      if (existing) { await api(`/api/quotes/${existing._id}`, { method: "PUT", json: payload }); setSaved(JSON.stringify(payload)); setOk("Saved."); const r = await api(`/api/quotes/${existing._id}`); setExisting(r.item); }
      else { const r = await api(`/api/quotes?category=${category}`, { json: { ...payload, category } }); router.replace(`${basePath}/${r.item._id}`); }
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }
  async function setStatus(status: string) {
    try { await api(`/api/quotes/${existing._id}`, { method: "PATCH", json: { status } }); setExisting({ ...existing, status }); setOk(`Marked as ${status}.`); } catch (e) { setErr((e as Error).message); }
  }
  async function clone(mode: "duplicate" | "revise") {
    if (dirty && !confirm("You have unsaved changes that will not be copied. Continue?")) return;
    try { const r = await api(`/api/quotes/${existing._id}/clone?mode=${mode}`, { method: "POST" }); router.push(`${basePath}/${r.item._id}`); } catch (e) { setErr((e as Error).message); }
  }

  const canExport = role !== "viewer";

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-slate-400" />;
  const hasCosting = lines.some((l) => l.bom?.items?.length);

  return (
    <>
      {/* action bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={basePath} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{existing ? `${existing.number}${existing.revision ? ` Rev ${existing.revision}` : ""}` : "New quotation"}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">{existing && <StatusBadge status={existing.status} />}{dirty && <span className="font-medium text-amber-600">Unsaved changes</span>}{readOnly && <span>Read only</span>}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {existing && (<>
            {canExport ? (
              <>
                <a className="btn-ghost" target="_blank" href={`/api/quotes/${existing._id}/pdf?inline=1`}><FileDown className="h-4 w-4" />PDF</a>
                <a className="btn-ghost" href={`/api/quotes/${existing._id}/excel`}><FileSpreadsheet className="h-4 w-4" />Excel</a>
              </>
            ) : (
              <span className="btn-ghost opacity-60" title="Viewers cannot download the PDF"><FileDown className="h-4 w-4" />PDF</span>
            )}
            {hasCosting && role !== "viewer" && <a className="btn-ghost" href={`/api/quotes/${existing._id}/costing`}><Calculator className="h-4 w-4" />Costing</a>}
            {role !== "viewer" && <button className="btn-ghost" onClick={() => setShowSend(true)}><Send className="h-4 w-4" />Share</button>}
            {role !== "viewer" && <button className="btn-ghost" onClick={() => clone("duplicate")}><Copy className="h-4 w-4" />Duplicate</button>}
            {role !== "viewer" && (role === "admin" || existing.createdBy === userId) && <button className="btn-ghost" onClick={() => clone("revise")}><GitBranch className="h-4 w-4" />Revise</button>}
            {!contentLocked && (
              <select className="input !w-32" value={existing.status} onChange={(e) => setStatus(e.target.value)}>{QUOTE_STATUS_PATCH.map((s) => <option key={s} value={s}>{quoteStatusLabel(s)}</option>)}</select>
            )}
          </>)}
          {!contentLocked && <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>}
        </div>
      </div>
      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {ok && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <fieldset disabled={contentLocked} className="contents">
          <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
          {/* details */}
          <section className="card overflow-hidden p-0">
            <div className="card-header !items-start">
              <div>
                <h2 className="card-header-title">Quotation details</h2>
                <p className="card-header-sub mt-0.5">Quote date, validity, Graco price list and GST</p>
              </div>
              {validThrough && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs text-slate-600">
                  <div className="font-semibold uppercase tracking-wide text-slate-400">Valid through</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{dmy(validThrough)}</div>
                </div>
              )}
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label" htmlFor="quote-date">Date</label>
                  <input id="quote-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="quote-validity">Valid for (days)</label>
                  <input id="quote-validity" className="input" type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(num(e.target.value))} />
                  <p className="mt-1.5 text-xs text-slate-500">From {dmy(date)} · {validityDays} day{validityDays === 1 ? "" : "s"}</p>
                </div>
                <div>
                  <label className="label" htmlFor="quote-referred">Referred by</label>
                  <input id="quote-referred" className="input" value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="e.g. Mr. B. Mushtaq Ali" />
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pricing &amp; tax</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="min-w-0 md:col-span-1">
                    <label className="label" htmlFor="quote-price-list">Price list</label>
                    <select id="quote-price-list" className="input" value={priceListId} onChange={(e) => { setPriceListId(e.target.value); setPriceManual(true); }}>
                      {lists.length === 0 && <option value="">No price list imported</option>}
                      {lists.map((l) => <option key={l._id} value={l._id}>{l.year}{l.name && l.name !== String(l.year) ? ` · ${l.name}` : ""}</option>)}
                    </select>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className={`badge ${priceManual ? "bg-amber-100 text-amber-800" : "bg-brand-50 text-brand-700"}`}>{priceManual ? "Manual" : "Auto"}</span>
                      <span>{priceManual ? "You chose this list" : `Picked for quote date ${dmy(date)}`}</span>
                      {list && <span className="text-slate-400">· effective {dmy(list.effectiveFrom)}</span>}
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="quote-gst">GST %</label>
                    <input id="quote-gst" className="input tabular-nums" type="number" min={0} max={28} step="0.5" value={gstRate} onChange={(e) => setGstRate(num(e.target.value))} />
                  </div>
                  <div>
                    <label className="label" htmlFor="quote-tax-type">Tax type</label>
                    <select id="quote-tax-type" className="input" value={taxType} onChange={(e) => setTaxType(e.target.value as "auto" | "intra" | "inter")}>
                      <option value="auto">Auto – from customer state</option>
                      <option value="intra">CGST + SGST (intra-state)</option>
                      <option value="inter">IGST (inter-state)</option>
                    </select>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {supply === "intra" ? `Applying CGST ${gstRate / 2}% + SGST ${gstRate / 2}%` : `Applying IGST ${gstRate}%`}
                      {taxType === "auto" && (customer?.stateCode
                        ? ` · company vs ${shortName(customer.name)} (${customer.stateCode})`
                        : " · select a customer to detect the state, or choose the tax type")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* customer */}
          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Customer</h2>
            <CustomerSearch onPick={chooseCustomer} />
            {customer && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3 text-sm"><div className="font-semibold">M/s. {customer.name}</div><div className="text-slate-600">{(customer.addressLines ?? []).join(", ")}{customer.pincode && ` – ${customer.pincode}`}</div>
                  <div className="mt-1 text-xs text-slate-500">GST: {customer.gstin || "—"}{customer.state && ` · ${customer.stateCode} ${customer.state}`}</div>
                  {!customer.gstin && <div className="mt-1 text-xs text-amber-600">No GST number on file – tax type assumed intra-state.</div>}</div>
                <div className="space-y-2">
                  {customer.contacts?.length > 1 && (
                    <select
                      className="input"
                      title="Choose which contact this quotation is addressed to"
                      value={Math.max(0, customer.contacts.findIndex((c: any) => c.name === contact.name && c.phone === contact.phone))}
                      onChange={(e) => { const c = customer.contacts[Number(e.target.value)]; setContact({ name: c.name, phone: c.phone }); }}
                    >
                      {customer.contacts.map((c: any, i: number) => (
                        <option key={i} value={i}>{[c.name, c.phone, c.designation].filter(Boolean).join(" · ") || `Contact ${i + 1}`}</option>
                      ))}
                    </select>
                  )}
                  <input className="input" placeholder="Contact person" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                  <input className="input" placeholder="Mobile" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                </div>
              </div>
            )}
          </section>
          </div>

          {/* items — Excel-style line grid (full width below details + preview) */}
          <section className="card min-w-0 overflow-hidden p-0 xl:col-span-2 xl:col-start-1 xl:row-start-2">
            <div className="card-header">
              <div>
                <h2 className="card-header-title">Items</h2>
                <p className="card-header-sub mt-0.5 flex items-center gap-1.5"><ClipboardPaste className="h-3.5 w-3.5 shrink-0" />Edit cells like a spreadsheet. White cells are editable; grey cells are calculated.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary !py-1.5" onClick={() => { const l = blankLine("package"); setLines([...lines, l]); setBomFor(l.id); }}><Layers className="h-4 w-4" />BOM package</button>
                <button type="button" className="btn-ghost !py-1.5 hidden" onClick={() => setLines([...lines, blankLine("package")])}><Package className="h-4 w-4" />Package</button>
                <button type="button" className="btn-ghost !py-1.5" onClick={() => setLines([...lines, blankLine("custom")])}><Wrench className="h-4 w-4" />Custom item</button>
              </div>
            </div>
            <div className="table-toolbar">
              <div className="min-w-0 flex-1"><PartPicker listId={priceListId} onPick={addPart} /></div>
            </div>
            <datalist id="hsn-list">{hsnList.map((h) => <option key={h.code} value={h.code}>{h.description}</option>)}</datalist>
            {staleParts.length > 0 && (
              <div className="mx-5 mb-3 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span>{staleParts.length} Graco part{staleParts.length > 1 ? "s were" : " was"} priced from a different year than the selected list.</span>
                <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={reprice}><RefreshCw className="h-3.5 w-3.5" />Reprice from {list?.year}</button>
              </div>
            )}
            <div className="px-3 pb-5 sm:px-5">
              <p className="mb-2 text-xs text-slate-400 lg:hidden">Swipe horizontally to edit all columns.</p>
              <div className="xl-sheet">
                <table className="min-w-[980px]">
                  <colgroup>
                    <col style={{ width: 36 }} /><col style={{ width: 72 }} /><col style={{ width: 100 }} /><col />
                    <col style={{ width: 72 }} /><col style={{ width: 56 }} />
                    <col style={{ width: 88 }} /><col style={{ width: 56 }} /><col style={{ width: 88 }} /><col style={{ width: 96 }} /><col style={{ width: 72 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {["S.NO", "TYPE", "CODE", "DESCRIPTION", "HSN", "QTY", "BASIC ₹", "DISC %", "UNIT ₹", "TOTAL ₹", ""].map((h) => (
                        <th key={h} className="xl-th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={11} className="border border-slate-200 py-12 text-center text-sm text-slate-400">
                          Search a Graco part above, or add a BOM package / custom item.
                        </td>
                      </tr>
                    )}
                    {lines.map((l, i) => {
                      const unit = lineUnit(l);
                      const margin = l.costPrice && unit ? ((unit - l.costPrice) / unit) * 100 : null;
                      const kindLabel = l.kind === "part" ? "Part" : l.kind === "package" ? "Package" : "Custom";
                      const last = customer?._id ? lastPrices[lineKey(l)] : undefined;
                      const lastDiff = last ? Math.round((unit - last.unitPrice) * 100) / 100 : 0;
                      const hasDetail = (l.kind === "package" || l.subItems.length > 0) || l.priceRef || l.agreement || margin !== null || !!last;
                      return (
                        <Fragment key={l.id}>
                          <tr className="odd:bg-white even:bg-slate-50/50">
                            <td className="xl-sn">{i + 1}</td>
                            <td className="border border-slate-200 px-1.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500" title={l.kind === "part" ? "Graco part" : l.kind}>{kindLabel}</td>
                            <td className="border border-slate-200 p-0">
                              <input className="xl-inp text-left" value={l.code} onChange={(e) => upd(l.id, { code: e.target.value })} onFocus={(e) => e.target.select()} />
                            </td>
                            <td className="border border-slate-200 p-0">
                              <textarea className="xl-inp min-h-[2.25rem] resize-y text-left" rows={1} value={l.description} onChange={(e) => upd(l.id, { description: e.target.value })} onFocus={(e) => e.target.select()} />
                            </td>
                            <td className="border border-slate-200 p-0">
                              <input className="xl-inp text-center" list="hsn-list" value={l.hsn} onChange={(e) => upd(l.id, { hsn: e.target.value })} onFocus={(e) => e.target.select()} />
                            </td>
                            <td className="border border-slate-200 p-0">
                              <input className="xl-inp text-center" type="number" min={0} value={l.qty || ""} onChange={(e) => upd(l.id, { qty: num(e.target.value) })} onFocus={(e) => e.target.select()} />
                            </td>
                            <td className="border border-slate-200 p-0">
                              <input className="xl-inp text-right tabular-nums" type="number" min={0} value={l.basicPrice || ""} onChange={(e) => upd(l.id, { basicPrice: num(e.target.value) })} onFocus={(e) => e.target.select()} />
                            </td>
                            <td className="border border-slate-200 p-0">
                              <input className="xl-inp text-center tabular-nums" type="number" min={0} max={100} value={l.discountPct || ""} onChange={(e) => upd(l.id, { discountPct: num(e.target.value) })} onFocus={(e) => e.target.select()} />
                            </td>
                            <td className="xl-ro text-right">{inr(unit)}</td>
                            <td className="xl-ro text-right font-semibold">{inr(lineTotal(l))}</td>
                            <td className="border border-slate-200 p-0 text-center">
                              <div className="flex items-center justify-center gap-0.5 text-slate-400">
                                <button type="button" title="Move up" onClick={() => move(i, -1)} className="p-1 hover:text-slate-700"><ArrowUp className="h-3.5 w-3.5" /></button>
                                <button type="button" title="Move down" onClick={() => move(i, 1)} className="p-1 hover:text-slate-700"><ArrowDown className="h-3.5 w-3.5" /></button>
                                <button type="button" title="Delete row" onClick={() => setLines(lines.filter((x) => x.id !== l.id))} className="p-1 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                          {hasDetail && (
                            <tr key={`${l.id}-detail`} className="bg-[#f8fafc]">
                              <td className="border border-slate-200 bg-slate-100" />
                              <td colSpan={10} className="border border-slate-200 px-3 py-2">
                                <div className="flex flex-wrap items-start gap-4">
                                  {(l.kind === "package" || l.subItems.length > 0) && (
                                    <div className="min-w-[12rem] flex-1">
                                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Consists of (one per line)</div>
                                      <textarea
                                        className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-100"
                                        rows={Math.min(8, Math.max(2, l.subItems.length + 1))}
                                        value={l.subItems.join("\n")}
                                        onChange={(e) => upd(l.id, { subItems: e.target.value.split("\n") })}
                                      />
                                    </div>
                                  )}
                                  {l.kind === "package" && (
                                    <div className="flex shrink-0 flex-col gap-1.5">
                                      {l.bom && (
                                        <div className="rounded border border-purple-200 bg-purple-50 px-2 py-1.5 text-xs text-purple-800">
                                          <b>BOM:</b> {l.bom.name}
                                          <div className="text-purple-600">{l.bom.items.length} items · {l.bom.date ? dmy(l.bom.date) : "–"}</div>
                                        </div>
                                      )}
                                      <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setBomFor(l.id)}><Layers className="h-3.5 w-3.5" />{l.bom ? "Change BOM" : "Select BOM"}</button>
                                      {l.bom?.bomId && (
                                        <div className="flex flex-wrap gap-2 text-xs font-medium text-brand-700">
                                          <button type="button" onClick={() => reloadBom(l)}>↻ Reload BOM</button>
                                          <a target="_blank" href={`${bomBasePath}/${l.bom.bomId}`}>Open BOM ↗</a>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {last && (
                                    <div className="min-w-[15rem] max-w-md rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
                                      <div className="flex items-center gap-1 font-semibold"><History className="h-3.5 w-3.5 shrink-0" />Last quoted to this customer: ₹{inr(last.unitPrice)}</div>
                                      <div className="text-emerald-700">
                                        {last.discountPct ? `₹${inr(last.basicPrice)} less ${last.discountPct}% · ` : ""}qty {last.qty} {last.uom} ·{" "}
                                        <a target="_blank" href={`/${last.category}/quotations/${last.quoteId}`} className="font-medium underline">{last.revision ? `${last.number} Rev ${last.revision}` : last.number}</a>
                                        {" "}· {dmy(last.date)} · {quoteStatusLabel(last.status)}
                                      </div>
                                      {last.times > 1 && <div className="text-emerald-700">Quoted {last.times} times · ₹{inr(last.minPrice)} – ₹{inr(last.maxPrice)}</div>}
                                      {lastDiff !== 0 && (
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                          <span className={lastDiff > 0 ? "font-medium text-amber-700" : "font-medium text-sky-700"}>
                                            Now ₹{inr(unit)} ({lastDiff > 0 ? "+" : "−"}₹{inr(Math.abs(lastDiff))} vs last time)
                                          </span>
                                          {!readOnly && (
                                            <button type="button" className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 font-medium text-emerald-700 hover:bg-emerald-100"
                                              onClick={() => upd(l.id, { basicPrice: last.basicPrice, discountPct: last.discountPct, agreement: undefined })}>
                                              Use this price
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {lastDiff === 0 && <div className="mt-0.5 font-medium text-emerald-700">✓ Same price as last time</div>}
                                    </div>
                                  )}
                                  <div className="min-w-[10rem] space-y-0.5 text-xs text-slate-500">
                                    {l.priceRef && <div>{l.priceRef.year} list · ₹{inr(l.priceRef.listPrice)} ref</div>}
                                    {l.agreement && <div className="font-medium text-purple-700">{l.agreement}</div>}
                                    {margin !== null && (
                                      <div className={margin < 10 ? "font-medium text-red-600" : ""}>
                                        Internal: landed ₹{inr(l.costPrice)}/unit · margin {margin.toFixed(1)}%{margin < 10 && " · low"}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {lines.length > 0 && (
                      <>
                        <tr className="bg-slate-100">
                          <td colSpan={9} className="border border-slate-200 px-2 py-1.5 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Subtotal</td>
                          <td className="xl-ro text-right font-semibold !bg-slate-100">₹{inr(totals.subtotal)}</td>
                          <td className="border border-slate-200 !bg-slate-100" />
                        </tr>
                        {supply === "intra" ? (
                          <>
                            <tr className="bg-slate-50">
                              <td colSpan={9} className="border border-slate-200 px-2 py-1 text-right text-xs text-slate-500">CGST {gstRate / 2}%</td>
                              <td className="xl-ro py-1 text-right !bg-slate-50">₹{inr(totals.cgst)}</td>
                              <td className="border border-slate-200" />
                            </tr>
                            <tr className="bg-slate-50">
                              <td colSpan={9} className="border border-slate-200 px-2 py-1 text-right text-xs text-slate-500">SGST {gstRate / 2}%</td>
                              <td className="xl-ro py-1 text-right !bg-slate-50">₹{inr(totals.sgst)}</td>
                              <td className="border border-slate-200" />
                            </tr>
                          </>
                        ) : (
                          <tr className="bg-slate-50">
                            <td colSpan={9} className="border border-slate-200 px-2 py-1 text-right text-xs text-slate-500">IGST {gstRate}%</td>
                            <td className="xl-ro py-1 text-right !bg-slate-50">₹{inr(totals.igst)}</td>
                            <td className="border border-slate-200" />
                          </tr>
                        )}
                        <tr className="bg-slate-50">
                          <td colSpan={9} className="border border-slate-200 px-2 py-1 text-right text-xs text-slate-500">Round off</td>
                          <td className="xl-ro py-1 text-right !bg-slate-50">₹{inr(totals.roundOff)}</td>
                          <td className="border border-slate-200" />
                        </tr>
                        <tr className="bg-amber-100 font-bold">
                          <td colSpan={9} className="border border-amber-200/80 px-2 py-2 text-right text-sm text-amber-900">Total</td>
                          <td className="border border-amber-200/80 bg-amber-100 px-2 py-2 text-right tabular-nums text-amber-950">₹{inr0(totals.total)}</td>
                          <td className="border border-amber-200/80 bg-amber-100" />
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              {lines.length > 0 && <p className="mt-2 text-xs text-slate-500">{totals.words}</p>}
            </div>
          </section>

          {/* image (hidden via CSS; state still works) */}
          <section className="card hidden p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Product image <span className="text-xs font-normal text-slate-400">(optional – printed beside the first “Consists of” list)</span></h2>
            <div className="flex items-center gap-4">
              {image ? <img src={image} alt="" className="h-24 rounded-lg border border-slate-200 object-contain" /> : <div className="grid h-24 w-32 place-items-center rounded-lg border border-dashed border-slate-300 text-slate-300"><ImagePlus className="h-7 w-7" /></div>}
              <div className="space-y-2">
                <label className="btn-ghost cursor-pointer"><ImagePlus className="h-4 w-4" />{image ? "Replace" : "Upload"} image<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setImage(await resizeImage(f)); } catch { setErr("Could not read that image."); } } e.target.value = ""; }} /></label>
                {image && <button type="button" className="ml-2 text-sm text-red-600" onClick={() => setImage(null)}>Remove</button>}
                <input className="input" value={imageCaption} placeholder="Caption (default: Image is for illustrative purpose only)" onChange={(e) => setImageCaption(e.target.value)} />
              </div>
            </div>
          </section>

          {/* terms (hidden via CSS; auto-fill on customer pick still works) */}
          <section className="card hidden p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-slate-900">Terms and conditions</h2>
              <div className="flex items-center gap-3">
              {templates.length > 0 && <select className="input !w-52 !py-1 text-sm" value="" onChange={(e) => { const t = templates.find((x) => x._id === e.target.value); if (t) { setTerms(fillTerms(t.terms, customer?.name ?? "Customer")); setTermsTouched(true); } }}><option value="">Apply template…</option>{templates.map((t) => <option key={t._id} value={t._id}>{t.name}{t.isDefault ? " (default)" : ""}</option>)}</select>}
              <button type="button" className="text-sm font-medium text-brand-600" onClick={() => { setTerms([...terms, { label: "", value: "" }]); setTermsTouched(true); }}><Plus className="mr-1 inline h-3.5 w-3.5" />Add term</button></div></div>
            <div className="space-y-2">
              {terms.length === 0 && <p className="text-sm text-slate-400">Terms are filled in automatically when you choose a customer.</p>}
              {terms.map((tm, i) => (
                <div key={i} className="flex gap-2">
                  <span className="w-5 pt-2 text-right text-xs text-slate-400">{i + 1}.</span>
                  <input className="input !w-40" placeholder="Label" value={tm.label} onChange={(e) => { setTerms(terms.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))); setTermsTouched(true); }} />
                  <input className="input" placeholder="Value" value={tm.value} onChange={(e) => { setTerms(terms.map((x, j) => (j === i ? { ...x, value: e.target.value } : x))); setTermsTouched(true); }} />
                  <button type="button" onClick={() => { setTerms(terms.filter((_, j) => j !== i)); setTermsTouched(true); }}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
                </div>
              ))}
            </div>
          </section>
        </fieldset>

        {/* live preview */}
        <aside className="min-w-0 xl:col-start-2 xl:row-start-1 xl:max-h-[calc(100vh-5rem)] self-start"><div className="xl:sticky xl:top-20">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Live preview</span><span className="font-normal normal-case text-slate-400">The PDF follows this layout</span></div>
          <div className="max-h-[min(70vh,42rem)] overflow-y-auto rounded-lg bg-slate-200 p-2 sm:p-3 xl:max-h-[calc(100vh-8rem)]"><QuotePreview q={previewDoc} /></div>
        </div></aside>
      </div>

      {showSend && existing && canExport && <ShareModal quote={existing} dirty={dirty} onClose={() => setShowSend(false)} />}
      {bomFor && <BomPicker category={existing?.category ?? category} bomBasePath={bomBasePath} onClose={() => { const l = lines.find((x) => x.id === bomFor); if (l && l.kind === "package" && !l.description && !l.bom && !l.basicPrice) setLines((ls) => ls.filter((x) => x.id !== bomFor)); setBomFor(null); }} onPick={(b) => applyBom(bomFor, b)} />}
    </>
  );
}

function CustomerSearch({ onPick }: { onPick: (c: any) => void }) {
  const [q, setQ] = useState(""); const [res, setRes] = useState<any[]>([]); const [open, setOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => api(`/api/customers?q=${encodeURIComponent(q)}`).then((r) => setRes(r.items.filter((c: any) => c.active !== false).slice(0, 8))).catch(() => {}), 200); return () => clearTimeout(t); }, [q]);
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-9" placeholder="Search customer by name or GST…" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && res.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {res.map((c) => (
            <button key={c._id} type="button" className="block w-full border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-brand-50" onMouseDown={() => { onPick(c); setQ(""); setOpen(false); }}>
              <div className="text-sm font-medium text-slate-900">{c.name}</div><div className="text-xs text-slate-500">{c.addressLines?.[c.addressLines.length - 1]} {c.gstin && `· ${c.gstin}`}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
