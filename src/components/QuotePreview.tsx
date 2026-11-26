/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
import { isHeading, lineNumbers, lineTotal, lineUnit } from "@/lib/quoteCalc";
import { inr } from "@/lib/format";
import {
  QUOTE_COLORS, PREVIEW_WIDTH as W, PREVIEW_MIN_HEIGHT, QUOTE_COLS, QUOTE_HEADS, pctLabel as pct, quoteMeta, quoteTotalRows,
  hasBank, firstPackageIndex, footerContact, companyContact, customerAddress, subItemParts, consistsList, consistsHeading,
} from "@/lib/quoteLayout";
import { displayNumber } from "@/lib/quoteCalc";

const { BRAND, NAVY, INK, MUTED, FAINT, LINE, ZEBRA, SOFT, HEAD_LINE } = QUOTE_COLORS;

const cap = { fontSize: 8, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase" as const, color: MUTED };
const num = { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };

/** The quotation layout as HTML, scaled to fit its container. components/pdf/QuotePdf.tsx draws the same layout for the PDF. */
export default function QuotePreview({ q }: { q: any }) {
  const wrap = useRef<HTMLDivElement>(null); const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6); const [h, setH] = useState(1123);
  useEffect(() => {
    const fit = () => { if (wrap.current) setScale(Math.min(1, wrap.current.clientWidth / W)); if (inner.current) setH(inner.current.scrollHeight); };
    fit(); const ro = new ResizeObserver(fit); wrap.current && ro.observe(wrap.current); inner.current && ro.observe(inner.current); return () => ro.disconnect();
  }, []);

  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const lines: any[] = q.lines ?? [];
  const nos = lineNumbers(lines);   // S.No starts again below every heading
  const terms: any[] = q.terms ?? [];
  const firstPk = firstPackageIndex(q);
  const meta = quoteMeta(q);
  const contact = companyContact(co);

  const th: React.CSSProperties = {
    background: NAVY, color: "#fff", fontWeight: 700, fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase",
    padding: "7px 4px", textAlign: "center", borderRight: `1px solid ${HEAD_LINE}`,
  };
  const td: React.CSSProperties = { padding: "6px 5px", borderBottom: `1px solid ${LINE}`, fontSize: 10.5, color: INK, verticalAlign: "top" };

  return (
    <div ref={wrap} className="w-full" style={{ height: h * scale }}>
      <div
        ref={inner}
        style={{ width: W, minHeight: PREVIEW_MIN_HEIGHT, display: "flex", flexDirection: "column", transform: `scale(${scale})`, transformOrigin: "top left", fontFamily: "Helvetica, Arial, sans-serif", color: INK, background: "#fff" }}
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
              <div style={{ fontSize: 21, fontWeight: 700, fontStyle: "italic", letterSpacing: 0.2, color: NAVY, lineHeight: 1.15 }}>{co.name}</div>
              {co.tagline && <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: BRAND, marginTop: 4 }}>{co.tagline}</div>}
            </div>
            <div style={{ width: 84, textAlign: "right" }}><img src={q.partnerLogo || "/graco-logo.png"} alt="" style={{ maxHeight: 58, maxWidth: 82, display: "inline-block" }} /></div>
          </div>

          {/* ---- contact block: address, then phone / web / GSTIN ---- */}
          <div style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, marginTop: 12, padding: "6px 0", fontSize: 8.5, color: MUTED, textAlign: "center" }}>
            {contact.address && <div>{contact.address}</div>}
            {contact.items.length > 0 && (
              <div style={{ marginTop: 3 }}>
                {contact.items.map((it, i) => (
                  <span key={i}>{i ? <span style={{ margin: "0 9px" }}>·</span> : null}<span style={it.bold ? { color: INK, fontWeight: 700 } : undefined}>{it.text}</span></span>
                ))}
              </div>
            )}
          </div>

          {/* ---- title + customer on the left, one details box on the right ---- */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginTop: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3.4, color: NAVY }}>QUOTATION</div>
              <div style={{ ...cap, marginTop: 4 }}>Sales Quotation</div>
              <div style={{ marginTop: 16 }}>
                <div style={{ ...cap, color: BRAND, borderBottom: `2px solid ${BRAND}`, paddingBottom: 3, display: "inline-block" }}>To</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>{cu.name ? `M/s. ${cu.name}` : <span style={{ color: FAINT, fontWeight: 400 }}>Select a customer…</span>}</div>
                <div style={{ fontSize: 10, lineHeight: 1.55, color: MUTED, marginTop: 3 }}>
                  {customerAddress(cu).map((l, i) => <div key={i}>{l}</div>)}
                  {cu.gstin && <div style={{ color: INK }}>GSTIN: <b>{cu.gstin}</b></div>}
                  {cu.contact?.name && <div style={{ marginTop: 3, color: INK }}>Kind Attn: <b>{cu.contact.name}</b>{cu.contact.phone ? ` · ${cu.contact.phone}` : ""}</div>}
                </div>
              </div>
            </div>
            <div style={{ width: 280, border: `1px solid ${LINE}`, background: SOFT }}>
              {meta.map(([k, v], i) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 9px", borderTop: i ? `1px solid ${LINE}` : undefined }}>
                  <span style={{ ...cap, whiteSpace: "nowrap" }}>{k}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- items ---- */}
        <div style={{ padding: "14px 34px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>{QUOTE_COLS.map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}</colgroup>
            <thead>
              <tr>
                {QUOTE_HEADS.map((h, i) => (
                  <th key={h} style={{ ...th, ...(i === 5 || i === 7 || i === 8 ? { textAlign: "right" } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#9AA5B1", padding: "18px 0" }}>Add an item to see it here…</td></tr>
              )}
              {lines.map((l: any, i: number) => isHeading(l) ? (
                <tr key={l.id ?? i} style={{ background: SOFT }}>
                  <td style={td} />
                  <td colSpan={8} style={{ ...td, fontWeight: 700, color: BRAND }}>{l.description}</td>
                </tr>
              ) : (
                <>
                  <tr key={l.id ?? i} style={{ background: i % 2 ? ZEBRA : "#fff" }}>
                    <td style={{ ...td, textAlign: "center", color: MUTED }}>{nos[i]}</td>
                    <td style={{ ...td, textAlign: "center", fontSize: 9.5 }}>{l.code}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{l.description}</td>
                    <td style={{ ...td, textAlign: "center", fontSize: 9.5 }}>{l.hsn}</td>
                    <td style={{ ...td, textAlign: "center" }}>{l.qty}</td>
                    <td style={{ ...td, ...num }}>{inr(l.basicPrice)}</td>
                    <td style={{ ...td, textAlign: "center", color: MUTED }}>{l.discountPct ? pct(l.discountPct) : "—"}</td>
                    <td style={{ ...td, ...num }}>{inr(lineUnit(l))}</td>
                    <td style={{ ...td, ...num, fontWeight: 700, color: NAVY }}>{inr(lineTotal(l))}</td>
                  </tr>
                  {consistsList(l).length > 0 && (
                    <tr key={`${l.id}-subs`}>
                      <td colSpan={9} style={{ padding: 0, borderBottom: `1px solid ${LINE}`, background: SOFT }}>
                        <div style={{ display: "flex" }}>
                          <div style={{ width: 300, padding: "6px 10px 8px" }}>
                            <div style={{ ...cap, color: BRAND, marginBottom: 3 }}>Consists of</div>
                            {consistsList(l).map((x: string, k: number) => {
                              const head = consistsHeading(x);
                              if (head) return <div key={k} style={{ fontSize: 9.5, fontWeight: 700, color: BRAND, lineHeight: 1.5, marginTop: k ? 3 : 0 }}>{head}</div>;
                              const [mark, text] = subItemParts(x);
                              return (
                                <div key={k} style={{ display: "flex", fontSize: 9.5, color: MUTED, lineHeight: 1.5 }}>
                                  <span style={{ width: 16, flexShrink: 0, color: BRAND, fontWeight: 700 }}>{mark}</span><span>{text}</span>
                                </div>
                              );
                            })}
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

        {/* ---- uploaded images ---- */}
        {q.images?.length > 0 && (
          <div style={{ padding: "14px 34px 0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {q.images.map((src: string, i: number) => (
                <div key={i} style={{ width: 234, height: 170, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
                  <img src={src} alt="" style={{ maxWidth: 226, maxHeight: 162, objectFit: "contain" }} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 7.5, color: MUTED, marginTop: 4 }}>{q.imageCaption || "Images are for illustrative purpose only"}</div>
          </div>
        )}

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
              {quoteTotalRows(q).map(([k, v, b]) => (
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
          {hasBank(co) && (
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
          <div style={{ width: 220, marginLeft: "auto", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700 }}>For <i>{co.name}</i></div>
            <div style={{ height: 34 }} />
            <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 4, fontSize: 9.5, color: MUTED }}>Authorised Signatory</div>
          </div>
        </div>

        {/* ---- footer band: pushed to the bottom of the sheet, as in the PDF ---- */}
        <div style={{ marginTop: "auto", paddingTop: 18 }}>
          <div style={{ background: SOFT, borderTop: `1px solid ${LINE}`, padding: "8px 34px 9px", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: NAVY }}>Thank you for your business!</div>
            <div style={{ fontSize: 8, color: MUTED, marginTop: 3 }}>{footerContact(q) || " "}</div>
            <div style={{ fontSize: 7.5, color: FAINT, marginTop: 3 }}>{displayNumber(q)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
