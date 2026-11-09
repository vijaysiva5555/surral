/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
import { displayNumber, lineTotal, lineUnit } from "@/lib/quoteCalc";
import { dmy, inr } from "@/lib/format";

const BLUE = "#00A9E8", GOLD = "#FFC000", YELLOW = "#FFEB3B", GRID = "#9AA5B1";
const W = 794; // A4 at 96dpi

/** HTML rendition of the PDF layout, scaled to fit its container */
export default function QuotePreview({ q }: { q: any }) {
  const wrap = useRef<HTMLDivElement>(null); const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6); const [h, setH] = useState(1123);
  useEffect(() => {
    const fit = () => { if (wrap.current) setScale(Math.min(1, wrap.current.clientWidth / W)); if (inner.current) setH(inner.current.scrollHeight); };
    fit(); const ro = new ResizeObserver(fit); wrap.current && ro.observe(wrap.current); inner.current && ro.observe(inner.current); return () => ro.disconnect();
  }, []);
  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const pct = (n: number) => `${n % 1 ? n.toFixed(1) : n}%`;
  const firstPk = (q.lines ?? []).findIndex((l: any) => l.subItems?.length);
  const th = { background: BLUE, color: "#fff", fontWeight: 700, fontSize: 10, padding: "6px 3px", textAlign: "center" as const, border: "1px solid #fff" };
  const td = { padding: "5px 5px", border: `1px solid ${GRID}`, fontSize: 11, verticalAlign: "middle" as const };

  return (
    <div ref={wrap} className="w-full" style={{ height: h * scale }}>
      <div ref={inner} style={{ width: W, transform: `scale(${scale})`, transformOrigin: "top left", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 11, color: "#111" }} className="bg-white shadow-lg ring-1 ring-slate-200">
        <div style={{ margin: 36, border: "1px solid #111" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 10px 0" }}>
            <div style={{ width: 90 }}><img src={q.logo || "/sscpl-logo.png"} alt="" style={{ maxHeight: 78, maxWidth: 86 }} /></div>
            <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontStyle: "italic", fontWeight: 700, fontSize: 21 }}>{co.name}</div><div style={{ fontStyle: "italic", fontWeight: 700, fontSize: 10, marginTop: 4 }}>{co.tagline}</div></div>
            <div style={{ width: 90, textAlign: "right" }}><img src={q.partnerLogo || "/graco-logo.png"} alt="" style={{ maxHeight: 66, maxWidth: 86, display: "inline-block" }} /></div>
          </div>
          <div style={{ display: "flex", padding: "4px 10px 8px" }}>
            <div style={{ flex: 1.25, fontSize: 10.5, lineHeight: 1.6 }}>
              {(co.addressLines ?? []).map((l: string, i: number) => <div key={i}>{l}</div>)}
              {co.state && <div>State:{co.state}</div>}{co.stateCode && <div>State Code:{co.stateCode}</div>}{co.gstin && <div>GST No:{co.gstin}</div>}
              {co.website && <div>Website: {co.website}</div>}{co.phone && <div>Phone:{co.phone}</div>}{co.mobile && <div>Mobile:{co.mobile}</div>}
            </div>
            <div style={{ flex: 1, paddingTop: 8 }}>
              <div style={{ color: "#E5381B", fontWeight: 700, fontSize: 16, textAlign: "right", marginBottom: 4 }}>Sales Quotation</div>
              {[["DATE", dmy(q.date)], ["QUOTE #", displayNumber(q)], ["Referred By", q.referredBy], ["VALID UNTIL", `${q.validityDays} Days from the date of Quotation`]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", marginTop: 2, fontSize: 10.5 }}><div style={{ width: 80, textAlign: "right", paddingRight: 8 }}>{k}</div><div style={{ flex: 1, borderBottom: `1px solid ${GRID}`, minHeight: 14, paddingLeft: 3 }}>{v}</div></div>
              ))}
            </div>
          </div>
          <div style={{ background: BLUE, color: "#fff", fontWeight: 700, textAlign: "center", padding: "4px 0" }}>Customer details:</div>
          <div style={{ display: "flex", padding: "10px", minHeight: 70 }}>
            <div style={{ flex: 1.25 }}>
              <div style={{ fontWeight: 700 }}>{cu.name ? `M/s.${cu.name}` : <span style={{ color: "#aaa" }}>Select a customer…</span>}</div>
              {(cu.addressLines ?? []).map((l: string, i: number) => <div key={i}>{l}</div>)}{cu.pincode && <div>{cu.pincode}</div>}
              <div style={{ marginTop: 6 }}>GST: {cu.gstin}</div>
            </div>
            <div style={{ flex: 1 }}>{cu.contact?.name && <div style={{ fontWeight: 700 }}>{cu.contact.name}</div>}{cu.contact?.phone && <div>Mobile: {cu.contact.phone}</div>}</div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>{[30, 62, 0, 62, 32, 76, 40, 76, 84].map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}</colgroup>
            <thead><tr>{["S.No", "Code No", "Description of Goods", "HSN Code", "Qty", "Basic Price in Rs.", "Disc.", "Unit Price in Rs.", "Total Price in Rs."].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(q.lines ?? []).map((l: any, i: number) => (
                <>
                  <tr key={l.id}>
                    <td style={{ ...td, textAlign: "center" }}>{i + 1}</td><td style={{ ...td, textAlign: "center" }}>{l.code}</td><td style={td}>{l.description}</td><td style={{ ...td, textAlign: "center" }}>{l.hsn}</td>
                    <td style={{ ...td, textAlign: "center" }}>{l.qty}</td><td style={{ ...td, textAlign: "right" }}>{inr(l.basicPrice)}</td>
                    <td style={{ ...td, textAlign: "center" }}>{l.discountPct ? pct(l.discountPct) : "-"}</td><td style={{ ...td, textAlign: "right" }}>{inr(lineUnit(l))}</td><td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{inr(lineTotal(l))}</td>
                  </tr>
                  {l.subItems?.length > 0 && (
                    <tr key={l.id + "s"}><td colSpan={9} style={{ padding: 0, borderBottom: `1px solid ${GRID}` }}>
                      <div style={{ display: "flex" }}>
                        <div style={{ width: 270 }}>
                          <div style={{ background: YELLOW, fontWeight: 700, textAlign: "center", padding: "3px 0", border: `1px solid ${GRID}` }}>Consists Of:</div>
                          {l.subItems.map((x: string, k: number) => <div key={k} style={{ background: "#F2F4F7", border: `1px solid ${GRID}`, borderTop: 0, padding: "3px 6px", fontSize: 10.5 }}>{x}</div>)}
                        </div>
                        {q.image && i === firstPk && <div style={{ flex: 1, textAlign: "center", padding: 8 }}><img src={q.image} alt="" style={{ maxWidth: 250, maxHeight: 200, display: "inline-block" }} /><div style={{ fontSize: 8, fontWeight: 700, marginTop: 3 }}>{q.imageCaption || "Image is for illustrative purpose only"}</div></div>}
                      </div>
                    </td></tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", marginTop: 10 }}>
            <div style={{ width: 420 }}>
              <div style={{ background: BLUE, color: "#fff", fontWeight: 700, fontSize: 10, padding: "3px 6px" }}>TERMS AND CONDITIONS</div>
              <div style={{ padding: "3px 6px", fontSize: 10.5, lineHeight: 1.6 }}>{(q.terms ?? []).map((tm: any, i: number) => <div key={i}>{i + 1}.{tm.label ? `${tm.label} : ` : ""}{tm.value}</div>)}</div>
            </div>
            <div style={{ flex: 1, paddingLeft: 14, fontSize: 11 }}>
              {[["Subtotal", t.subtotal, true], ...(t.supply === "inter" ? [[`IGST ${pct(t.gstRate)}`, t.igst]] : [[`CGST ${pct(t.gstRate / 2)}`, t.cgst], [`SGST ${pct(t.gstRate / 2)}`, t.sgst]]), ["ROF(+/-)", t.roundOff]].map(([k, v, b]: any) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 6px" }}><b>{k}</b><span style={{ fontWeight: b ? 700 : 400 }}>{inr(v)}</span></div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 6px", background: GOLD, fontWeight: 700, marginTop: 4, fontSize: 12 }}><span>TOTAL</span><span>{inr(t.total)}</span></div>
              <div style={{ marginTop: 6, fontSize: 10.5 }}><b>Amount in Words(Rupees): </b>{(t.words ?? "").replace(/^Rupees /, "")}</div>
            </div>
          </div>
          <div style={{ textAlign: "center", margin: "18px 0 10px", fontSize: 10.5 }}>
            <div>If you have any questions about this price quote, please contact</div>
            {q.preparedBy?.name && <div style={{ fontWeight: 700 }}>{q.preparedBy.name}{q.preparedBy.phone ? ` - ${q.preparedBy.phone}` : ""}</div>}
            <div style={{ fontStyle: "italic", fontWeight: 700, fontSize: 13, marginTop: 8 }}>Thank You For Your Business!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
