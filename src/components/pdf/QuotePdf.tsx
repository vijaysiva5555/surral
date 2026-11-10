/* eslint-disable @typescript-eslint/no-explicit-any, jsx-a11y/alt-text */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { lineTotal, lineUnit, displayNumber } from "@/lib/quoteCalc";
import { dmy, inr } from "@/lib/format";
import { fit } from "@/lib/imageSize";

Font.registerHyphenationCallback((w) => [w]);

const BLUE = "#00A9E8", NAVY = "#0B2C4D", RED = "#E5381B", GOLD = "#FFC000", YELLOW = "#FFEB3B", GRID = "#9AA5B1", LIGHT = "#F2F4F7", LINE = "#DCE4EC";
const COLS = { sno: 24, code: 52, desc: 175, hsn: 48, qty: 26, basic: 58, disc: 34, unit: 58, total: 64 };

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 44, paddingHorizontal: 28, fontFamily: "Helvetica", fontSize: 8.5, color: "#111" },
  frame: { borderWidth: 1, borderColor: "#111", padding: 0 },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 6 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, textAlign: "center", color: NAVY, letterSpacing: 0.2 },
  tagline: { fontFamily: "Helvetica-BoldOblique", fontSize: 7.5, textAlign: "center", marginTop: 3 },
  info: { flexDirection: "row", paddingHorizontal: 8, paddingTop: 4, paddingBottom: 6 },
  addr: { fontSize: 8, lineHeight: 1.55 },
  qTitle: { color: NAVY, fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: 2, textAlign: "right", marginBottom: 3 },
  mRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 1.5 },
  mLab: { width: 62, textAlign: "right", paddingRight: 6, fontSize: 8 },
  mVal: { flex: 1, borderBottomWidth: 0.7, borderBottomColor: GRID, paddingBottom: 1, paddingLeft: 3, fontSize: 8 },
  band: { backgroundColor: BLUE, color: "#fff", fontFamily: "Helvetica-Bold", textAlign: "center", paddingVertical: 3, fontSize: 8.5 },
  cust: { flexDirection: "row", padding: 8, paddingBottom: 10, minHeight: 56 },
  th: { backgroundColor: NAVY, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 7.5, textAlign: "center", paddingVertical: 5, paddingHorizontal: 2, borderRightWidth: 0.7, borderRightColor: "#fff", justifyContent: "center" },
  td: { paddingVertical: 4, paddingHorizontal: 3, borderRightWidth: 0.7, borderRightColor: GRID },
  row: { flexDirection: "row", borderTopWidth: 0.7, borderTopColor: GRID },
  num: { textAlign: "right" },
  ctr: { textAlign: "center" },
  consists: { backgroundColor: YELLOW, fontFamily: "Helvetica-Bold", textAlign: "center", paddingVertical: 2.5, borderWidth: 0.7, borderColor: GRID },
  sub: { borderWidth: 0.7, borderTopWidth: 0, borderColor: GRID, paddingVertical: 2.5, paddingHorizontal: 4, backgroundColor: LIGHT, fontSize: 8 },
  box: { flexDirection: "row" },
  tHead: { backgroundColor: NAVY, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 7.5, paddingVertical: 2.5, paddingHorizontal: 4 },
  term: { fontSize: 8, lineHeight: 1.5, paddingVertical: 1 },
  tot: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: 6 },
  foot: { alignItems: "center", marginTop: 14, paddingBottom: 6 },
});

const Cell = ({ w, style, children }: { w: number; style?: any; children?: React.ReactNode }) => <View style={[s.td, { width: w }, style]}>{children}</View>;

export default function QuotePdf({ q, logo, graco }: { q: any; logo?: any; graco?: any }) {
  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const hasImage = !!q.image;
  const pct = (n: number) => `${n % 1 ? n.toFixed(1) : n}%`;

  return (
    <Document title={`Quotation ${displayNumber(q)}`} author={co.name}>
      <Page size="A4" style={s.page}>
        {/* running header on continuation pages */}
        <View fixed render={({ pageNumber }) => pageNumber > 1 ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6, paddingBottom: 3, borderBottomWidth: 0.7, borderBottomColor: LINE }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{co.name}</Text><Text style={{ fontSize: 8 }}>Quotation {displayNumber(q)} · {cu.name}</Text>
          </View>) : null} />

        <View style={s.frame}>
          {/* ---- letterhead ---- */}
          <View style={s.head}>
            <View style={{ width: 70 }}>{logo && <Image src={{ data: logo.data, format: logo.format }} style={fit(logo, 60, 66)} />}</View>
            <View style={{ flex: 1 }}><Text style={s.title}>{co.name}</Text>{!!co.tagline && <Text style={s.tagline}>{co.tagline}</Text>}</View>
            <View style={{ width: 70, alignItems: "flex-end" }}>{graco && <Image src={{ data: graco.data, format: graco.format }} style={fit(graco, 62, 58)} />}</View>
          </View>
          <View style={s.info}>
            <View style={[s.addr, { flex: 1.25 }]}>
              {(co.addressLines ?? []).map((l: string, i: number) => <Text key={i}>{l}</Text>)}
              {!!co.state && <Text>State:{co.state}</Text>}
              {!!co.stateCode && <Text>State Code:{co.stateCode}</Text>}
              {!!co.gstin && <Text>GST No:{co.gstin}</Text>}
              {!!co.website && <Text>Website:  {co.website}</Text>}
              {!!co.phone && <Text>Phone:{co.phone}</Text>}
              {!!co.mobile && <Text>Mobile:{co.mobile}</Text>}
              {!!q.preparedBy?.name && <Text>Prepared by:{q.preparedBy.name}{q.preparedBy.phone ? ` - ${q.preparedBy.phone}` : ""}</Text>}
            </View>
            <View style={{ flex: 1, paddingTop: 6 }}>
              <Text style={s.qTitle}>QUOTATION</Text>
              {[["DATE", dmy(q.date)], ["QUOTE #", displayNumber(q)], ["REFERENCE", q.referredBy || "-"], ["VALID UNTIL", `${q.validityDays} Days from the date of Quotation`]].map(([k, v]) => (
                <View key={k} style={s.mRow}><Text style={s.mLab}>{k}</Text><Text style={s.mVal}>{v || " "}</Text></View>
              ))}
            </View>
          </View>

          {/* ---- customer ---- */}
          <Text style={s.band}>TO</Text>
          <View style={s.cust}>
            <View style={{ flex: 1.25, paddingRight: 10 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>M/s.{cu.name}</Text>
              {(cu.addressLines ?? []).map((l: string, i: number) => <Text key={i}>{l}{i === (cu.addressLines.length - 1) && cu.pincode && !l.includes(cu.pincode) ? ` - ${cu.pincode}` : ""}</Text>)}
              <Text style={{ marginTop: 6 }}>GST: {cu.gstin}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {!!cu.contact?.name && <Text style={{ fontFamily: "Helvetica-Bold" }}>{cu.contact.name}</Text>}
              {!!cu.contact?.phone && <Text>Mobile: {cu.contact.phone}</Text>}
            </View>
          </View>

          {/* ---- items ---- */}
          <View>
            <View style={{ flexDirection: "row" }} fixed>
              {[["S.No", COLS.sno], ["Code No", COLS.code], ["Description of Goods", COLS.desc], ["HSN Code", COLS.hsn], ["Qty", COLS.qty], ["Basic Price in Rs.", COLS.basic], ["Disc.", COLS.disc], ["Unit Price in Rs.", COLS.unit], ["Total Price in Rs.", COLS.total]].map(([h, w]) => (
                <View key={h as string} style={[s.th, { width: w as number }]}><Text>{h}</Text></View>
              ))}
            </View>
            {(q.lines ?? []).map((l: any, i: number) => (
              <View key={l.id ?? i} wrap={false}>
                <View style={s.row}>
                  <Cell w={COLS.sno} style={s.ctr}><Text>{i + 1}</Text></Cell>
                  <Cell w={COLS.code} style={s.ctr}><Text>{l.code}</Text></Cell>
                  <Cell w={COLS.desc}><Text>{l.description}</Text></Cell>
                  <Cell w={COLS.hsn} style={s.ctr}><Text>{l.hsn}</Text></Cell>
                  <Cell w={COLS.qty} style={s.ctr}><Text>{l.qty}</Text></Cell>
                  <Cell w={COLS.basic} style={s.num}><Text>{inr(l.basicPrice)}</Text></Cell>
                  <Cell w={COLS.disc} style={s.ctr}><Text>{l.discountPct ? pct(l.discountPct) : "-"}</Text></Cell>
                  <Cell w={COLS.unit} style={s.num}><Text>{inr(lineUnit(l))}</Text></Cell>
                  <Cell w={COLS.total} style={[s.num, { borderRightWidth: 0 }]}><Text style={{ fontFamily: "Helvetica-Bold" }}>{inr(lineTotal(l))}</Text></Cell>
                </View>
                {l.subItems?.length > 0 && (
                  <View style={[s.box, { borderTopWidth: 0.7, borderTopColor: GRID }]}>
                    <View style={{ width: COLS.sno + COLS.code + COLS.desc + COLS.hsn + (hasImage && i === firstPackage(q) ? 0 : 0) }}>
                      <Text style={s.consists}>Consists Of:</Text>
                      {l.subItems.map((x: string, k: number) => <Text key={k} style={s.sub}>{x}</Text>)}
                    </View>
                    {hasImage && i === firstPackage(q) && (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 6 }}>
                        <Image src={q.image} style={{ maxWidth: 210, maxHeight: 170, objectFit: "contain" }} />
                        <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", marginTop: 3 }}>{q.imageCaption || "Image is for illustrative purpose only"}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
            <View style={{ borderTopWidth: 0.7, borderTopColor: GRID }} />
          </View>

          {/* ---- terms + totals ---- */}
          <View style={{ flexDirection: "row", marginTop: 8 }} wrap={false}>
            <View style={{ width: 318 }}>
              <Text style={s.tHead}>TERMS AND CONDITIONS</Text>
              <View style={{ paddingHorizontal: 4, paddingTop: 2 }}>
                {(q.terms ?? []).map((tm: any, i: number) => <Text key={i} style={s.term}>{i + 1}.{tm.label ? `${tm.label} : ` : ""}{tm.value}</Text>)}
              </View>
            </View>
            <View style={{ flex: 1, paddingLeft: 10 }}>
              <View style={s.tot}><Text style={{ fontFamily: "Helvetica-Bold" }}>Subtotal</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{inr(t.subtotal)}</Text></View>
              {t.supply === "intra" ? (<>
                <View style={s.tot}><Text style={{ fontFamily: "Helvetica-Bold" }}>CGST {pct(t.gstRate / 2)}</Text><Text>{inr(t.cgst)}</Text></View>
                <View style={s.tot}><Text style={{ fontFamily: "Helvetica-Bold" }}>SGST {pct(t.gstRate / 2)}</Text><Text>{inr(t.sgst)}</Text></View>
              </>) : <View style={s.tot}><Text style={{ fontFamily: "Helvetica-Bold" }}>IGST {pct(t.gstRate)}</Text><Text>{inr(t.igst)}</Text></View>}
              <View style={s.tot}><Text style={{ fontFamily: "Helvetica-Bold" }}>ROF(+/-)</Text><Text>{inr(t.roundOff)}</Text></View>
              <View style={[s.tot, { backgroundColor: NAVY, marginTop: 4, paddingVertical: 4 }]}><Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5, color: "#fff" }}>TOTAL</Text><Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5, color: "#fff" }}>{inr(t.total)}</Text></View>
              <Text style={{ marginTop: 5, fontSize: 8 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Amount in Words(Rupees): </Text>{(t.words ?? "").replace(/^Rupees /, "")}</Text>
            </View>
          </View>

          {/* ---- bank + signature ---- */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }} wrap={false}>
            {(co.bank?.name || co.bank?.branch || co.bank?.accountNo || co.bank?.ifsc) ? (
              <View style={{ flex: 1, paddingRight: 20 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7.5, color: NAVY, marginBottom: 2 }}>BANK DETAILS</Text>
                {!!co.bank.name && <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>{co.bank.name}</Text>}
                {!!co.bank.branch && <Text style={{ fontSize: 8 }}>Branch: {co.bank.branch}</Text>}
                {!!co.bank.accountNo && <Text style={{ fontSize: 8 }}>A/c No: {co.bank.accountNo}</Text>}
                {!!co.bank.ifsc && <Text style={{ fontSize: 8 }}>IFSC: {co.bank.ifsc}</Text>}
              </View>
            ) : <View style={{ flex: 1 }} />}
            <View style={{ width: 150, alignItems: "center" }}>
              <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>For {co.name}</Text>
              <View style={{ height: 26 }} />
              <View style={{ borderTopWidth: 0.7, borderTopColor: "#111", width: "100%", paddingTop: 3 }}>
                <Text style={{ fontSize: 7.5, textAlign: "center" }}>Authorised Signatory</Text>
              </View>
            </View>
          </View>

          {/* ---- footer ---- */}
          <View style={s.foot} wrap={false}>
            <Text style={{ fontSize: 8 }}>If you have any questions about this price quote, please contact</Text>
            {!!q.preparedBy?.name && <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{q.preparedBy.name}{q.preparedBy.phone ? ` - ${q.preparedBy.phone}` : ""}</Text>}
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: NAVY, marginTop: 5 }}>Thank you for your business!</Text>
          </View>
        </View>

        <Text fixed style={{ position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 7, color: "#667", textAlign: "center" }}
          render={({ pageNumber, totalPages }) => `${displayNumber(q)}  ·  Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

/** the product photo sits beside the first "Consists of" block */
function firstPackage(q: any) { return (q.lines ?? []).findIndex((l: any) => l.subItems?.length > 0); }
