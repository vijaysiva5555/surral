/* eslint-disable @typescript-eslint/no-explicit-any, jsx-a11y/alt-text */
/* PDF of a quotation. It reproduces the live preview (components/QuotePreview.tsx) — same blocks, colours and
   proportions: every size here is the preview's px value × 0.75 (preview = 794 px wide, A4 = 595 pt). */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { lineTotal, lineUnit, displayNumber } from "@/lib/quoteCalc";
import { inr } from "@/lib/format";
import { fit } from "@/lib/imageSize";
import {
  QUOTE_COLORS, PREVIEW_WIDTH, PX, QUOTE_COLS, QUOTE_HEADS, pctLabel as pct, quoteMeta, quoteDetails, quoteTotalRows,
  hasBank, firstPackageIndex, footerContact,
} from "@/lib/quoteLayout";

Font.registerHyphenationCallback((w) => [w]);

const { BRAND, NAVY, INK, MUTED, FAINT, LINE, ZEBRA, SOFT } = QUOTE_COLORS;
const p = (px: number) => Math.round(px * PX * 100) / 100;
const B = "Helvetica-Bold";
const GUTTER = p(34);

// column widths in pt; the description column takes what is left of the content width
const CONTENT = p(PREVIEW_WIDTH) - 2 * GUTTER;
const FIXED = QUOTE_COLS.reduce((a, w) => a + p(w), 0);
const COLS = QUOTE_COLS.map((w) => (w ? p(w) : CONTENT - FIXED));
const RIGHT = new Set([5, 7, 8]);

const s = StyleSheet.create({
  page: { paddingTop: p(28), paddingBottom: p(54), fontFamily: "Helvetica", color: INK, backgroundColor: "#fff" },
  cap: { fontSize: p(8), fontFamily: B, letterSpacing: p(0.9), color: MUTED },
  section: { paddingHorizontal: GUTTER },
  heading: { fontSize: p(8), fontFamily: B, letterSpacing: p(0.9), color: BRAND, borderBottomWidth: p(2), borderBottomColor: BRAND, paddingBottom: p(3), alignSelf: "flex-start" },
  th: { backgroundColor: NAVY, color: "#fff", fontFamily: B, fontSize: p(8.5), letterSpacing: p(0.4), paddingVertical: p(7), paddingHorizontal: p(4), borderRightWidth: 0.75, borderRightColor: "rgba(255,255,255,0.16)", justifyContent: "center" },
  td: { paddingVertical: p(6), paddingHorizontal: p(5), fontSize: p(10.5) },
});

const Cap = ({ children, style }: { children: React.ReactNode; style?: any }) => <Text style={[s.cap, style]}>{String(children).toUpperCase()}</Text>;
const Heading = ({ children }: { children: string }) => <Text style={s.heading}>{children.toUpperCase()}</Text>;

export default function QuotePdf({ q, logo, graco }: { q: any; logo?: any; graco?: any }) {
  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const lines: any[] = q.lines ?? [];
  const terms: any[] = q.terms ?? [];
  const firstPk = firstPackageIndex(q);

  return (
    <Document title={`Quotation ${displayNumber(q)}`} author={co.name}>
      <Page size="A4" style={s.page}>
        {/* accent edge (every page) */}
        <View fixed style={{ position: "absolute", top: 0, left: 0, right: 0, height: p(6), flexDirection: "row" }}>
          <View style={{ width: p(132), backgroundColor: BRAND }} />
          <View style={{ flex: 1, backgroundColor: NAVY }} />
        </View>

        {/* running header on continuation pages */}
        <View fixed style={s.section} render={({ pageNumber }) => pageNumber > 1 ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: p(10), paddingBottom: p(5), borderBottomWidth: 0.75, borderBottomColor: LINE }}>
            <Text style={{ fontFamily: B, fontSize: p(9.5), color: NAVY }}>{co.name}</Text>
            <Text style={{ fontSize: p(9.5), color: MUTED }}>Quotation {displayNumber(q)} · {cu.name}</Text>
          </View>) : null} />

        <View style={s.section}>
          {/* ---- letterhead ---- */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: p(84) }}>{logo && <Image src={{ data: logo.data, format: logo.format }} style={fit(logo, p(82), p(70))} />}</View>
            <View style={{ flex: 1, alignItems: "center", marginHorizontal: p(14) }}>
              <Text style={{ fontSize: p(21), fontFamily: B, letterSpacing: p(0.2), color: NAVY, lineHeight: 1.15, textAlign: "center" }}>{co.name}</Text>
              {!!co.tagline && <Text style={{ fontSize: p(8.5), fontFamily: B, letterSpacing: p(0.5), color: BRAND, marginTop: p(4), textAlign: "center" }}>{String(co.tagline).toUpperCase()}</Text>}
            </View>
            <View style={{ width: p(84), alignItems: "flex-end" }}>{graco && <Image src={{ data: graco.data, format: graco.format }} style={fit(graco, p(82), p(58))} />}</View>
          </View>

          {/* ---- contact strip ---- */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: LINE, marginTop: p(12), paddingTop: p(6), paddingBottom: p(4) }}>
            {[
              ...(co.addressLines ?? []).map((l: string) => [l, false]),
              ...(co.phone ? [[`Ph ${co.phone}`, false]] : []),
              ...(co.mobile ? [[`Mob ${co.mobile}`, false]] : []),
              ...(co.email ? [[co.email, false]] : []),
              ...(co.website ? [[co.website, false]] : []),
              ...(co.gstin ? [[`GSTIN ${co.gstin}`, true]] : []),
              ...(co.stateCode ? [[`State Code ${co.stateCode}`, false]] : []),
            ].map(([txt, bold]: any, i: number) => (
              <Text key={i} style={{ fontSize: p(8.5), color: bold ? INK : MUTED, fontFamily: bold ? B : "Helvetica", marginRight: p(18), marginBottom: p(2) }}>{txt}</Text>
            ))}
          </View>

          {/* ---- title + meta ---- */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: p(18) }}>
            <View>
              <Text style={{ fontSize: p(22), fontFamily: B, letterSpacing: p(3.4), color: NAVY }}>QUOTATION</Text>
              <Cap style={{ marginTop: p(4) }}>Sales Quotation</Cap>
            </View>
            <View style={{ width: p(268), borderWidth: 0.75, borderColor: LINE, backgroundColor: SOFT }}>
              {quoteMeta(q).map(([k, v], i) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: p(4), paddingHorizontal: p(9), borderTopWidth: i ? 0.75 : 0, borderTopColor: LINE }}>
                  <Cap>{k}</Cap>
                  <Text style={{ fontSize: p(9.5), fontFamily: B, textAlign: "right", marginLeft: p(10) }}>{v}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ---- parties ---- */}
          <View style={{ flexDirection: "row", marginTop: p(16) }}>
            <View style={{ flex: 1, marginRight: p(18) }}>
              <Heading>To</Heading>
              <Text style={{ fontSize: p(12.5), fontFamily: B, marginTop: p(6) }}>{cu.name ? `M/s. ${cu.name}` : ""}</Text>
              <View style={{ marginTop: p(3) }}>
                {(cu.addressLines ?? []).map((l: string, i: number) => <Text key={i} style={{ fontSize: p(10), lineHeight: 1.55, color: MUTED }}>{l}</Text>)}
                {!!cu.pincode && <Text style={{ fontSize: p(10), lineHeight: 1.55, color: MUTED }}>{cu.pincode}</Text>}
                {!!cu.gstin && <Text style={{ fontSize: p(10), lineHeight: 1.55, color: INK }}>GSTIN: <Text style={{ fontFamily: B }}>{cu.gstin}</Text></Text>}
                {!!cu.contact?.name && (
                  <Text style={{ fontSize: p(10), lineHeight: 1.55, color: INK, marginTop: p(3) }}>
                    Kind Attn: <Text style={{ fontFamily: B }}>{cu.contact.name}</Text>{cu.contact.phone ? ` · ${cu.contact.phone}` : ""}
                  </Text>
                )}
              </View>
            </View>
            <View style={{ width: p(250) }}>
              <Heading>Quotation Details</Heading>
              <View style={{ marginTop: p(6) }}>
                {quoteDetails(q).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: p(2.5) }}>
                    <Text style={{ fontSize: p(9.5), color: MUTED }}>{k}</Text>
                    <Text style={{ fontSize: p(9.5), fontFamily: B, textAlign: "right", marginLeft: p(10), flexShrink: 1 }}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ---- items ---- */}
        <View style={[s.section, { paddingTop: p(14) }]}>
          <View fixed style={{ flexDirection: "row" }}>
            {QUOTE_HEADS.map((h, i) => (
              <View key={h} style={[s.th, { width: COLS[i] }, i === QUOTE_HEADS.length - 1 ? { borderRightWidth: 0 } : {}]}>
                <Text style={{ textAlign: RIGHT.has(i) ? "right" : "center" }}>{h.toUpperCase()}</Text>
              </View>
            ))}
          </View>
          {lines.map((l: any, i: number) => {
            const cells: [string, any][] = [
              [String(i + 1), { textAlign: "center", color: MUTED }],
              [l.code ?? "", { textAlign: "center", fontSize: p(9.5) }],
              [l.description ?? "", { fontFamily: B }],
              [l.hsn ?? "", { textAlign: "center", fontSize: p(9.5) }],
              [String(l.qty ?? ""), { textAlign: "center" }],
              [inr(l.basicPrice), { textAlign: "right" }],
              [l.discountPct ? pct(l.discountPct) : "—", { textAlign: "center", color: MUTED }],
              [inr(lineUnit(l)), { textAlign: "right" }],
              [inr(lineTotal(l)), { textAlign: "right", fontFamily: B, color: NAVY }],
            ];
            return (
              <View key={l.id ?? i} wrap={false}>
                <View style={{ flexDirection: "row", backgroundColor: i % 2 ? ZEBRA : "#fff", borderBottomWidth: 0.75, borderBottomColor: LINE }}>
                  {cells.map(([txt, st], c) => <View key={c} style={[s.td, { width: COLS[c] }]}><Text style={st}>{txt}</Text></View>)}
                </View>
                {l.subItems?.length > 0 && (
                  <View style={{ flexDirection: "row", backgroundColor: SOFT, borderBottomWidth: 0.75, borderBottomColor: LINE }}>
                    <View style={{ width: p(300), paddingTop: p(6), paddingBottom: p(8), paddingHorizontal: p(10) }}>
                      <Cap style={{ color: BRAND, marginBottom: p(3) }}>Consists of</Cap>
                      {l.subItems.map((x: string, k: number) => (
                        <View key={k} style={{ flexDirection: "row" }}>
                          <Text style={{ fontSize: p(9.5), color: BRAND, lineHeight: 1.5, marginRight: p(6) }}>•</Text>
                          <Text style={{ fontSize: p(9.5), color: MUTED, lineHeight: 1.5, flex: 1 }}>{x}</Text>
                        </View>
                      ))}
                    </View>
                    {!!q.image && i === firstPk && (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: p(8) }}>
                        <Image src={q.image} style={{ maxWidth: p(218), maxHeight: p(168), objectFit: "contain" }} />
                        <Text style={{ fontSize: p(7.5), color: MUTED, marginTop: p(3), textAlign: "center" }}>{q.imageCaption || "Image is for illustrative purpose only"}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ---- terms + totals ---- */}
        <View style={[s.section, { flexDirection: "row", paddingTop: p(16) }]} wrap={false}>
          <View style={{ flex: 1, marginRight: p(20) }}>
            <Heading>{"Terms & Conditions"}</Heading>
            <View style={{ marginTop: p(6) }}>
              {terms.map((tm: any, i: number) => (
                <View key={i} style={{ flexDirection: "row" }}>
                  <Text style={{ width: p(18), fontSize: p(9.5), lineHeight: 1.65, color: FAINT }}>{i + 1}.</Text>
                  <Text style={{ flex: 1, fontSize: p(9.5), lineHeight: 1.65, color: MUTED }}>
                    {tm.label ? <Text style={{ fontFamily: B, color: INK }}>{tm.label}: </Text> : null}{tm.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ width: p(286) }}>
            <View style={{ borderWidth: 0.75, borderColor: LINE }}>
              {quoteTotalRows(q).map(([k, v, b]) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: p(5), paddingHorizontal: p(9), borderBottomWidth: 0.75, borderBottomColor: LINE }}>
                  <Text style={{ fontSize: p(10), color: b ? INK : MUTED, fontFamily: b ? B : "Helvetica" }}>{k}</Text>
                  <Text style={{ fontSize: p(10), fontFamily: b ? B : "Helvetica" }}>{inr(v)}</Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: NAVY, paddingVertical: p(8), paddingHorizontal: p(9) }}>
                <Text style={{ fontSize: p(9.5), fontFamily: B, letterSpacing: p(1), color: "#fff" }}>TOTAL</Text>
                {/* the built-in PDF fonts have no ₹ glyph, so the PDF prints "Rs." where the preview shows ₹ */}
                <Text style={{ fontSize: p(13), fontFamily: B, color: "#fff" }}>Rs. {inr(t.total)}</Text>
              </View>
            </View>
            <View style={{ marginTop: p(8), borderLeftWidth: p(3), borderLeftColor: BRAND, backgroundColor: SOFT, paddingVertical: p(6), paddingHorizontal: p(8) }}>
              <Cap>Amount in words</Cap>
              <Text style={{ fontSize: p(9.5), fontFamily: B, lineHeight: 1.5, marginTop: p(1) }}>{t.words || "—"}</Text>
            </View>
          </View>
        </View>

        {/* ---- bank + signature ---- */}
        <View style={[s.section, { flexDirection: "row", justifyContent: "space-between", paddingTop: p(18) }]} wrap={false}>
          {hasBank(co) ? (
            <View style={{ flex: 1, marginRight: p(24) }}>
              <Cap style={{ color: BRAND, marginBottom: p(4) }}>Bank Details</Cap>
              {!!co.bank.name && <Text style={{ fontSize: p(9.5), lineHeight: 1.7, fontFamily: B, color: INK }}>{co.bank.name}</Text>}
              {!!co.bank.branch && <Text style={{ fontSize: p(9.5), lineHeight: 1.7, color: MUTED }}>Branch: {co.bank.branch}</Text>}
              {!!co.bank.accountNo && <Text style={{ fontSize: p(9.5), lineHeight: 1.7, color: MUTED }}>A/c No: {co.bank.accountNo}</Text>}
              {!!co.bank.ifsc && <Text style={{ fontSize: p(9.5), lineHeight: 1.7, color: MUTED }}>IFSC: {co.bank.ifsc}</Text>}
            </View>
          ) : <View style={{ flex: 1 }} />}
          <View style={{ width: p(220), alignItems: "center" }}>
            <Text style={{ fontSize: p(10), fontFamily: B, textAlign: "center" }}>For {co.name}</Text>
            <View style={{ height: p(34) }} />
            <View style={{ borderTopWidth: 0.75, borderTopColor: INK, paddingTop: p(4), width: "100%" }}>
              <Text style={{ fontSize: p(9.5), color: MUTED, textAlign: "center" }}>Authorised Signatory</Text>
            </View>
          </View>
        </View>

        {/* ---- footer ---- */}
        <View style={{ marginTop: p(18), backgroundColor: SOFT, borderTopWidth: 0.75, borderTopColor: LINE, paddingVertical: p(8), paddingHorizontal: GUTTER, alignItems: "center" }} wrap={false}>
          <Text style={{ fontSize: p(10), fontFamily: B, color: NAVY }}>Thank you for your business!</Text>
          <Text style={{ fontSize: p(8), color: MUTED, marginTop: p(2) }}>{footerContact(q) || " "}</Text>
        </View>

        <Text fixed style={{ position: "absolute", bottom: p(20), left: GUTTER, right: GUTTER, fontSize: p(8), color: FAINT, textAlign: "center" }}
          render={({ pageNumber, totalPages }) => `${displayNumber(q)}  ·  Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}
