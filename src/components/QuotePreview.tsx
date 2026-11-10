/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
import { displayNumber, lineTotal, lineUnit } from "@/lib/quoteCalc";
import { dmy, inr } from "@/lib/format";

const BRAND = "#0AA5E8";   // Surral blue
const NAVY = "#0B2C4D";    // headings, table head, totals band
const INK = "#0F172A";
const MUTED = "#5B6B7C";
const LINE = "#DCE4EC";
const ZEBRA = "#F7FAFC";
const SOFT = "#F4F8FB";
const W = 794;             // A4 at 96dpi

const cap = { fontSize: 8, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase" as const, color: MUTED };
const num = { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };

/** HTML rendition of the PDF layout, scaled to fit its container */
export default function QuotePreview({ q }: { q: any }) {
  const wrap = useRef<HTMLDivElement>(null); const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6); const [h, setH] = useState(1123);
  useEffect(() => {
    const fit = () => { if (wrap.current) setScale(Math.min(1, wrap.current.clientWidth / W)); if (inner.current) setH(inner.current.scrollHeight); };
    fit(); const ro = new ResizeObserver(fit); wrap.current && ro.observe(wrap.current); inner.current && ro.observe(inner.current); return () => ro.disconnect();
  }, []);

  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const lines: any[] = q.lines ?? [];
  const terms: any[] = q.terms ?? [];
  const pct = (n: number) => `${n % 1 ? n.toFixed(1) : n}%`;
  const firstPk = lines.findIndex((l) => l.subItems?.length);
  const listYear = lines.reduce((y, l) => Math.max(y, Number(l.priceRef?.year ?? 0)), 0);

  const validUntil = (() => {
    if (q.validUntil) return dmy(q.validUntil);
    const d = new Date(`${String(q.date ?? "").slice(0, 10)}T12:00:00`);
    if (Number.isNaN(+d)) return `${q.validityDays ?? 0} days`;
    d.setDate(d.getDate() + Number(q.validityDays ?? 0));
    return dmy(d);
  })();

  const meta: [string, string][] = [
    ["Quotation No.", displayNumber(q)],
    ["Date", dmy(q.date)],
    ["Valid Until", validUntil],
    ["Reference", q.referredBy || "—"],
    ["Price List", listYear ? String(listYear) : "—"],
  ];
  const supply: [string, string][] = [
    ["Place of Supply", cu.state ? `${cu.state}${cu.stateCode ? ` (${cu.stateCode})` : ""}` : "—"],
    ["Tax", t.supply === "inter" ? `IGST ${pct(t.gstRate)}` : `CGST + SGST ${pct(t.gstRate ?? 0)}`],
  ];

  const th: React.CSSProperties = {
    background: NAVY, color: "#fff", fontWeight: 700, fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase",
    padding: "7px 4px", textAlign: "center", borderRight: "1px solid rgba(255,255,255,.16)",
  };
  const td: React.CSSProperties = { padding: "6px 5px", borderBottom: `1px solid ${LINE}`, fontSize: 10.5, color: INK, verticalAlign: "top" };

  return (
    <div ref={wrap} className="w-full" style={{ height: h * scale }}>
      <div
        ref={inner}
        style={{ width: W, transform: `scale(${scale})`, transformOrigin: "top left", fontFamily: "Helvetica, Arial, sans-serif", color: INK, background: "#fff" }}
        className="shadow-lg ring-1 ring-slate-200"
      >
        {/* accent edge */}
        <div style={{ display: "flex", height: 6 }}>
          <div style={{ width: 132, background: BRAND }} />
          <div style={{ flex: 1, background: NAVY }} />
        </div>

        <div style={{ padding: "22px 34px 0" }}>
          {/* ---- letterhead ---- */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 84 }}><img src={q.logo || "/sscpl-logo.png"} alt="" style={{ maxHeight: 70, maxWidth: 82 }} /></div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: 0.2, color: NAVY, lineHeight: 1.15 }}>{co.name}</div>
              {co.tagline && <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: BRAND, marginTop: 4 }}>{co.tagline}</div>}
            </div>
            <div style={{ width: 84, textAlign: "right" }}><img src={q.partnerLogo || "/graco-logo.png"} alt="" style={{ maxHeight: 58, maxWidth: 82, display: "inline-block" }} /></div>
          </div>

          {/* ---- contact strip ---- */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 18px", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, marginTop: 12, padding: "6px 0", fontSize: 8.5, color: MUTED }}>
            {(co.addressLines ?? []).map((l: string, i: number) => <span key={i}>{l}</span>)}
            {co.phone && <span>Ph {co.phone}</span>}
            {co.mobile && <span>Mob {co.mobile}</span>}
            {co.email && <span>{co.email}</span>}
            {co.website && <span>{co.website}</span>}
            {co.gstin && <span style={{ color: INK, fontWeight: 700 }}>GSTIN {co.gstin}</span>}
            {co.stateCode && <span>State Code {co.stateCode}</span>}
          </div>

          {/* ---- title + meta ---- */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 18 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3.4, color: NAVY }}>QUOTATION</div>
              <div style={{ ...cap, marginTop: 4 }}>Sales Quotation</div>
            </div>
            <div style={{ width: 268, border: `1px solid ${LINE}`, background: SOFT }}>
              {meta.map(([k, v], i) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 9px", borderTop: i ? `1px solid ${LINE}` : undefined }}>
                  <span style={cap}>{k}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ---- parties ---- */}
          <div style={{ display: "flex", gap: 18, marginTop: 16 }}>
            <div style={{ flex: 1.35 }}>
              <div style={{ ...cap, color: BRAND, borderBottom: `2px solid ${BRAND}`, paddingBottom: 3, display: "inline-block" }}>To</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>{cu.name ? `M/s. ${cu.name}` : <span style={{ color: "#9AA5B1", fontWeight: 400 }}>Select a customer…</span>}</div>
              <div style={{ fontSize: 10, lineHeight: 1.55, color: MUTED, marginTop: 3 }}>
                {(cu.addressLines ?? []).map((l: string, i: number) => <div key={i}>{l}</div>)}
                {cu.pincode && <div>{cu.pincode}</div>}
                {cu.gstin && <div style={{ color: INK }}>GSTIN: <b>{cu.gstin}</b></div>}
                {cu.contact?.name && <div style={{ marginTop: 3, color: INK }}>Kind Attn: <b>{cu.contact.name}</b>{cu.contact.phone ? ` · ${cu.contact.phone}` : ""}</div>}
              </div>
            </div>
            <div style={{ width: 250 }}>
              <div style={{ ...cap, color: BRAND, borderBottom: `2px solid ${BRAND}`, paddingBottom: 3, display: "inline-block" }}>Quotation Details</div>
              <div style={{ marginTop: 6 }}>
                {[...supply, ["Prepared By", q.preparedBy?.name ? `${q.preparedBy.name}${q.preparedBy.phone ? ` · ${q.preparedBy.phone}` : ""}` : "—"]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "2.5px 0", fontSize: 9.5 }}>
                    <span style={{ color: MUTED }}>{k}</span><span style={{ fontWeight: 700, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ---- items ---- */}
        <div style={{ padding: "14px 34px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>{[30, 68, 0, 58, 30, 74, 40, 74, 86].map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}</colgroup>
            <thead>
              <tr>
                {["S.No", "Code", "Description of Goods", "HSN", "Qty", "Basic Price", "Disc.", "Unit Price", "Amount"].map((h, i) => (
                  <th key={h} style={{ ...th, ...(i === 5 || i === 7 || i === 8 ? { textAlign: "right" } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#9AA5B1", padding: "18px 0" }}>Add an item to see it here…</td></tr>
              )}
              {lines.map((l: any, i: number) => (
                <>
                  <tr key={l.id ?? i} style={{ background: i % 2 ? ZEBRA : "#fff" }}>
                    <td style={{ ...td, textAlign: "center", color: MUTED }}>{i + 1}</td>
                    <td style={{ ...td, textAlign: "center", fontSize: 9.5 }}>{l.code}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{l.description}</td>
                    <td style={{ ...td, textAlign: "center", fontSize: 9.5 }}>{l.hsn}</td>
                    <td style={{ ...td, textAlign: "center" }}>{l.qty}</td>
                    <td style={{ ...td, ...num }}>{inr(l.basicPrice)}</td>
                    <td style={{ ...td, textAlign: "center", color: MUTED }}>{l.discountPct ? pct(l.discountPct) : "—"}</td>
                    <td style={{ ...td, ...num }}>{inr(lineUnit(l))}</td>
                    <td style={{ ...td, ...num, fontWeight: 700, color: NAVY }}>{inr(lineTotal(l))}</td>
                  </tr>
                  {l.subItems?.length > 0 && (
                    <tr key={`${l.id}-subs`}>
                      <td colSpan={9} style={{ padding: 0, borderBottom: `1px solid ${LINE}`, background: SOFT }}>
                        <div style={{ display: "flex" }}>
                          <div style={{ width: 300, padding: "6px 10px 8px" }}>
                            <div style={{ ...cap, color: BRAND, marginBottom: 3 }}>Consists of</div>
                            {l.subItems.map((x: string, k: number) => (
                              <div key={k} style={{ display: "flex", gap: 6, fontSize: 9.5, color: MUTED, lineHeight: 1.5 }}>
                                <span style={{ color: BRAND }}>•</span><span>{x}</span>
                              </div>
                            ))}
                          </div>
                          {q.image && i === firstPk && (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
                              <div style={{ textAlign: "center" }}>
                                <img src={q.image} alt="" style={{ maxWidth: 218, maxHeight: 168, display: "inline-block" }} />
                                <div style={{ fontSize: 7.5, color: MUTED, marginTop: 3 }}>{q.imageCaption || "Image is for illustrative purpose only"}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- terms + totals ---- */}
        <div style={{ display: "flex", gap: 20, padding: "16px 34px 0" }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...cap, color: BRAND, borderBottom: `2px solid ${BRAND}`, paddingBottom: 3, display: "inline-block" }}>Terms &amp; Conditions</div>
            <div style={{ marginTop: 6 }}>
              {terms.length === 0 && <div style={{ fontSize: 9.5, color: "#9AA5B1" }}>Terms appear here…</div>}
              {terms.map((tm: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 6, fontSize: 9.5, lineHeight: 1.65, color: MUTED }}>
                  <span style={{ minWidth: 12, color: "#9AA5B1" }}>{i + 1}.</span>
                  <span>{tm.label ? <b style={{ color: INK }}>{tm.label}: </b> : null}{tm.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: 286 }}>
            <div style={{ border: `1px solid ${LINE}` }}>
              {[["Subtotal", t.subtotal, true],
                ...(t.supply === "inter"
                  ? [[`IGST ${pct(t.gstRate)}`, t.igst]]
                  : [[`CGST ${pct((t.gstRate ?? 0) / 2)}`, t.cgst], [`SGST ${pct((t.gstRate ?? 0) / 2)}`, t.sgst]]),
                ["Round Off", t.roundOff]].map(([k, v, b]: any) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 9px", borderBottom: `1px solid ${LINE}`, fontSize: 10 }}>
                  <span style={{ color: b ? INK : MUTED, fontWeight: b ? 700 : 400 }}>{k}</span>
                  <span style={{ ...num, fontWeight: b ? 700 : 400 }}>{inr(v)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: NAVY, color: "#fff", padding: "8px 9px" }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1 }}>TOTAL</span>
                <span style={{ ...num, fontSize: 13, fontWeight: 700 }}>₹ {inr(t.total)}</span>
              </div>
            </div>
            <div style={{ marginTop: 8, borderLeft: `3px solid ${BRAND}`, background: SOFT, padding: "6px 8px", fontSize: 9.5, lineHeight: 1.5 }}>
              <span style={{ ...cap, color: MUTED }}>Amount in words</span>
              <div style={{ fontWeight: 700, marginTop: 1 }}>{t.words || "—"}</div>
            </div>
          </div>
        </div>

        {/* ---- bank + signature ---- */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "18px 34px 0" }}>
          {(co.bank?.name || co.bank?.branch || co.bank?.accountNo || co.bank?.ifsc) && (
            <div style={{ flex: 1 }}>
              <div style={{ ...cap, color: BRAND, marginBottom: 4 }}>Bank Details</div>
              <div style={{ fontSize: 9.5, lineHeight: 1.7, color: MUTED }}>
                {co.bank.name && <div><b style={{ color: INK }}>{co.bank.name}</b></div>}
                {co.bank.branch && <div>Branch: {co.bank.branch}</div>}
                {co.bank.accountNo && <div>A/c No: {co.bank.accountNo}</div>}
                {co.bank.ifsc && <div>IFSC: {co.bank.ifsc}</div>}
              </div>
            </div>
          )}
          <div style={{ width: 220, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700 }}>For {co.name}</div>
            <div style={{ height: 34 }} />
            <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 4, fontSize: 9.5, color: MUTED }}>Authorised Signatory</div>
          </div>
        </div>

        {/* ---- footer ---- */}
        <div style={{ marginTop: 18, background: SOFT, borderTop: `1px solid ${LINE}`, padding: "8px 34px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: NAVY }}>Thank you for your business!</div>
          <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>
            {[q.preparedBy?.name, q.preparedBy?.phone, co.email].filter(Boolean).join("  ·  ") || " "}
          </div>
        </div>
      </div>
    </div>
  );
}
