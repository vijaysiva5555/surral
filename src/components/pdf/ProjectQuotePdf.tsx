/* eslint-disable @typescript-eslint/no-explicit-any, jsx-a11y/alt-text */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { inr } from "@/lib/format";
import { fit } from "@/lib/imageSize";

Font.registerHyphenationCallback((w) => [w]);

const NAVY = "#0B2C4D", BLUE = "#0AA5E8", LINE = "#B6C2CE", SOFT = "#F4F8FB", MUTED = "#55657A";

const COLS = { sno: 32, desc: 265, qty: 58, unit: 90, total: 90 };

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 42, paddingHorizontal: 30, fontFamily: "Helvetica", fontSize: 8.5, color: "#111" },
  head: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1.2, borderBottomColor: NAVY, paddingBottom: 6 },
  coName: { fontFamily: "Helvetica-Bold", fontSize: 17, color: NAVY, textAlign: "center" },
  tagline: { fontSize: 7.5, textAlign: "center", marginTop: 3, color: MUTED },
  headAddr: { fontSize: 7, textAlign: "center", marginTop: 2, color: MUTED },
  meta: { marginTop: 12 },
  row: { flexDirection: "row", marginBottom: 3 },
  lab: { width: 92, fontFamily: "Helvetica-Bold", color: NAVY },
  val: { flex: 1 },
  subject: { marginTop: 6, fontFamily: "Helvetica-Bold" },
  para: { marginTop: 10, lineHeight: 1.65, textAlign: "justify" },
  sign: { marginTop: 12 },
  signName: { fontFamily: "Helvetica-Bold", marginTop: 10 },
  band: { backgroundColor: NAVY, color: "#fff", fontFamily: "Helvetica-Bold", paddingVertical: 3, paddingHorizontal: 5, marginTop: 14, fontSize: 8 },
  tbl: { marginTop: 8 },
  th: { backgroundColor: SOFT, fontFamily: "Helvetica-Bold", fontSize: 8, paddingVertical: 4, paddingHorizontal: 4, borderWidth: 0.6, borderColor: LINE, color: NAVY },
  td: { paddingVertical: 3.5, paddingHorizontal: 4, borderWidth: 0.6, borderColor: LINE, fontSize: 8.5 },
  ctr: { textAlign: "center" },
  num: { textAlign: "right" },
  two: { flexDirection: "row", marginTop: 8 },
  eqHead: { backgroundColor: SOFT, fontFamily: "Helvetica-Bold", fontSize: 8, paddingVertical: 3, paddingHorizontal: 5, borderWidth: 0.6, borderColor: LINE, color: NAVY },
  bullet: { flexDirection: "row", marginTop: 2 },
  dot: { width: 9 },
  offerTitle: { marginTop: 12, fontFamily: "Helvetica-Bold", fontSize: 9.5, color: NAVY },
  subHead: { marginTop: 6, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  small: { fontSize: 7.5, color: MUTED },
  foot: { position: "absolute", bottom: 20, left: 30, right: 30, fontSize: 7, color: MUTED, textAlign: "center" },
  bold: { fontFamily: "Helvetica-Bold" },
  termLab: { fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 8.5, marginTop: 6 },
  termVal: { fontSize: 8.5, lineHeight: 1.5 },
});

const Cell = ({ w, style, children }: { w?: number; style?: any; children?: React.ReactNode }) => (
  <View style={[s.td, w ? { width: w } : { flex: 1 }, style]}>{children}</View>
);

export default function ProjectQuotePdf({ q, logo }: { q: any; logo?: any }) {
  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const addr: string[] = co.addressLines ?? [];
  const offers: any[] = q.offers ?? [];

  return (
    <Document title={`Project Quotation ${q.number}`} author={co.name}>
      <Page size="A4" style={s.page}>
        <View fixed render={({ pageNumber }) => (pageNumber > 1 ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, paddingBottom: 3, borderBottomWidth: 0.6, borderBottomColor: LINE }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{co.name}</Text>
            <Text style={{ fontSize: 8 }}>{q.number} · {cu.name}</Text>
          </View>
        ) : null)} />

        {/* ---- letterhead ---- */}
        <View style={s.head}>
          <View style={{ width: 62 }}>{logo && <Image src={{ data: logo.data, format: logo.format }} style={fit(logo, 56, 54)} />}</View>
          <View style={{ flex: 1 }}>
            <Text style={s.coName}>{co.name}</Text>
            {!!co.tagline && <Text style={s.tagline}>{co.tagline}</Text>}
            {addr.length > 0 && <Text style={s.headAddr}>{addr.join(", ")}{co.gstin ? `  ·  GSTIN ${co.gstin}` : ""}</Text>}
          </View>
          <View style={{ width: 62 }} />
        </View>

        {/* ---- letter ---- */}
        <View style={s.meta}>
          <View style={s.row}><Text style={s.lab}>Date: -</Text><Text style={s.val}>{dmy(q.date)}</Text></View>
          <View style={s.row}><Text style={s.lab}>Customer Name: -</Text><Text style={[s.val, s.signName, { marginTop: 0 }]}>{cu.name}</Text></View>
          {(cu.addressLines ?? []).map((l: string, i: number) => (
            <View key={i} style={s.row}><Text style={s.lab}>{i === 0 ? "" : ""}</Text><Text style={s.val}>{l}{i === (cu.addressLines.length - 1) && cu.pincode && !String(l).includes(cu.pincode) ? ` - ${cu.pincode}` : ""}</Text></View>
          ))}
          <View style={s.row}><Text style={s.lab}>Kind Attn: -</Text><Text style={s.val}>{cu.contact?.name}{cu.contact?.phone ? ` (${cu.contact.phone})` : ""}</Text></View>
          <View style={s.row}><Text style={s.lab}>Offer Ref: -</Text><Text style={[s.val, s.bold]}>{q.number}</Text></View>
          {!!q.subject && <Text style={s.subject}>Subject: {q.subject}</Text>}
        </View>

        <Text style={s.para}>{q.intro || `As discussed with you we offered for ${q.subject || "the system"}. Please go through same.`}</Text>

        <View style={s.sign}>
          <Text>Yours faithfully,</Text>
          <Text style={[s.bold, { marginTop: 10 }]}>For {co.name},</Text>
          {!!q.signerName && <Text style={s.signName}>{q.signerName}</Text>}
          {!!q.signerPhone && <Text style={{ fontSize: 8 }}>{q.signerPhone}</Text>}
          {!!q.signerEmail && <Text style={{ fontSize: 8 }}>{q.signerEmail}</Text>}
        </View>

        {/* ---- summary ---- */}
        <View style={s.tbl}>
          <View style={{ flexDirection: "row" }}>
            {[["Name", 150], ["Modifications", 175], ["Quotation No", 110], ["Date", 90]].map(([h, w]) => (
              <Text key={h as string} style={[s.th, { width: w as number }]}>{h}</Text>
            ))}
          </View>
          <View style={{ flexDirection: "row" }}>
            <Cell w={150}><Text> </Text></Cell>
            <Cell w={175}><Text> </Text></Cell>
            <Cell w={110}><Text style={s.bold}>{q.number}</Text></Cell>
            <Cell w={90}><Text>{dmy(q.date)}</Text></Cell>
          </View>
          <View style={{ flexDirection: "row" }}>
            <Cell w={265}><Text>Prepared by: <Text style={s.bold}>{q.preparedBy || q.createdByName || "-"}</Text></Text></Cell>
            <Cell w={260}><Text>Approved by: <Text style={s.bold}>{q.approvedBy || "-"}</Text></Text></Cell>
          </View>
        </View>

        {/* ---- equipment ---- */}
        {(q.equipmentGraco?.length > 0 || q.equipmentSurral?.length > 0) && (
          <View style={s.two}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={s.eqHead}>Details: Graco Equipment’s</Text>
              {(q.equipmentGraco ?? []).map((x: string, i: number) => (
                <View key={i} style={s.bullet}><Text style={s.dot}>-</Text><Text style={{ flex: 1, lineHeight: 1.5 }}>{x}</Text></View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.eqHead}>Details: Surral Equipment’s</Text>
              {(q.equipmentSurral ?? []).map((x: string, i: number) => (
                <View key={i} style={s.bullet}><Text style={s.dot}>-</Text><Text style={{ flex: 1, lineHeight: 1.5 }}>{x}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* ---- technical specs ---- */}
        {!!q.technicalTitle && <Text style={[s.offerTitle, { fontSize: 9 }]}>TECHNICAL DESCRIPTION: - {q.technicalTitle}</Text>}
        {(q.specs ?? []).length > 0 && (
          <View style={[s.tbl, { marginTop: 5 }]}>
            <Text style={[s.th, { width: 535 }]}>Technical Specifications</Text>
            {(q.specs ?? []).map((sp: any, i: number) => (
              <View key={i} style={{ flexDirection: "row" }} wrap={false}>
                <Cell w={215}><Text>{sp.label}</Text></Cell>
                <Cell w={320}><Text>{sp.value}</Text></Cell>
              </View>
            ))}
          </View>
        )}

        {/* ---- offers ---- */}
        {offers.map((o, oi) => (
          <View key={oi} wrap={false}>
            {!!o.title && <Text style={s.offerTitle}>{o.title}</Text>}
            <View style={[s.tbl, { marginTop: 4 }]}>
              <View style={{ flexDirection: "row" }}>
                <Text style={[s.th, { width: COLS.sno }]}>S.No.</Text>
                <Text style={[s.th, { width: COLS.desc }]}>Description</Text>
                <Text style={[s.th, { width: COLS.qty }]}>Qty.</Text>
                <Text style={[s.th, { width: COLS.unit }]}>Unit Price in Rs.</Text>
                <Text style={[s.th, { width: COLS.total }]}>Total Price in Rs.</Text>
              </View>
              {(o.items ?? []).map((l: any, i: number) => (
                <View key={i} style={{ flexDirection: "row" }}>
                  <Cell w={COLS.sno} style={s.ctr}><Text>{i + 1}</Text></Cell>
                  <Cell w={COLS.desc}><Text>{l.description}</Text></Cell>
                  <Cell w={COLS.qty} style={s.ctr}><Text>{l.qty}</Text></Cell>
                  <Cell w={COLS.unit} style={s.num}><Text>{inr(l.unitPrice)}</Text></Cell>
                  <Cell w={COLS.total} style={s.num}><Text style={s.bold}>{inr(qtyNum(l.qty) * (Number(l.unitPrice) || 0))}</Text></Cell>
                </View>
              ))}
            </View>

            {(o.consists ?? []).length > 0 && (
              <>
                <Text style={s.subHead}>Graco Supply Consists of: -</Text>
                <View style={[s.tbl, { marginTop: 3 }]}>
                  <View style={{ flexDirection: "row" }}>
                    <Text style={[s.th, { width: COLS.sno }]}>S.No.</Text>
                    <Text style={[s.th, { width: COLS.desc + COLS.unit }]}>Description</Text>
                    <Text style={[s.th, { width: COLS.qty + COLS.total }]}>Qty.</Text>
                  </View>
                  {(o.consists ?? []).map((c: any, i: number) => (
                    <View key={i} style={{ flexDirection: "row" }}>
                      <Cell w={COLS.sno} style={s.ctr}><Text>{i + 1}</Text></Cell>
                      <Cell w={COLS.desc + COLS.unit}><Text>{c.description}</Text></Cell>
                      <Cell w={COLS.qty + COLS.total} style={s.ctr}><Text>{c.qty}</Text></Cell>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        ))}

        {/* ---- offer total ---- */}
        <View wrap={false} style={{ marginTop: 12 }}>
          <Text style={[s.offerTitle, { marginTop: 0 }]}>OFFER TOTAL</Text>
          <View style={{ flexDirection: "row", marginTop: 4 }}>
            <Text style={[s.th, { width: COLS.sno }]}>S.No.</Text>
            <Text style={[s.th, { width: COLS.desc }]}>Description</Text>
            <Text style={[s.th, { width: COLS.qty }]}>Qty.</Text>
            <Text style={[s.th, { width: COLS.unit }]}>Unit Price in Rs.</Text>
            <Text style={[s.th, { width: COLS.total }]}>Total Price in Rs.</Text>
          </View>
          {offers.map((o, oi) => (o.items ?? []).map((l: any, i: number) => (
            <View key={`${oi}-${i}`} style={{ flexDirection: "row" }}>
              <Cell w={COLS.sno} style={s.ctr}><Text>{cellNo(offers, oi, i)}</Text></Cell>
              <Cell w={COLS.desc}><Text>{l.description}</Text></Cell>
              <Cell w={COLS.qty} style={s.ctr}><Text>{l.qty}</Text></Cell>
              <Cell w={COLS.unit} style={s.num}><Text>{inr(l.unitPrice)}</Text></Cell>
              <Cell w={COLS.total} style={s.num}><Text>{inr(qtyNum(l.qty) * (Number(l.unitPrice) || 0))}</Text></Cell>
            </View>
          )))}
          <View style={{ flexDirection: "row", backgroundColor: SOFT }}>
            <Cell w={COLS.sno + COLS.desc + COLS.qty + COLS.unit} style={{ justifyContent: "center" }}><Text style={[s.bold, { textAlign: "right" }]}>Total</Text></Cell>
            <Cell w={COLS.total} style={s.num}><Text style={s.bold}>{inr(t.total)}</Text></Cell>
          </View>
          <View style={{ flexDirection: "row" }}>
            <Cell w={COLS.sno + COLS.desc + COLS.qty + COLS.unit}><Text style={s.bold}>Rupees: {String(t.words ?? "").replace(/^Rupees /, "")}</Text></Cell>
            <Cell w={COLS.total} />
          </View>
          <Text style={{ marginTop: 4, fontFamily: "Helvetica-Bold" }}>{t.gstNote || "GST 18% Extra"}</Text>
        </View>

        {/* ---- exclusions ---- */}
        {(q.exclusions ?? []).length > 0 && (
          <View style={{ marginTop: 12 }} wrap={false}>
            <Text style={[s.offerTitle, { marginTop: 0 }]}>Exclusions: -</Text>
            {(q.exclusions ?? []).map((x: string, i: number) => (
              <View key={i} style={s.bullet}><Text style={s.dot}>-</Text><Text style={{ flex: 1, lineHeight: 1.5 }}>{x}</Text></View>
            ))}
          </View>
        )}

        {/* ---- terms ---- */}
        <View style={{ marginTop: 12 }}>
          <Text style={[s.offerTitle, { marginTop: 0 }]}>TERMS &amp; CONDITIONS: -</Text>
          <Text style={{ marginTop: 3 }}>Above-mentioned prices are Ex, Chennai. Order to be placed on</Text>
          <Text style={[s.bold, { marginTop: 2 }]}>M/s. {co.name},</Text>
          {(co.addressLines ?? []).map((l: string, i: number) => <Text key={i}>{l}</Text>)}
          {!!co.gstin && <Text>GSTIN: - {co.gstin}</Text>}
          {!!co.email && <Text>E-Mail: - {co.email}</Text>}
          {(q.terms ?? []).map((tm: any, i: number) => (
            <View key={i} wrap={false}>
              <Text style={s.termLab}>{String(tm.label).toUpperCase()}: -</Text>
              {String(tm.value).split(/\n+/).filter(Boolean).map((line, j) => (
                <View key={j} style={s.bullet}><Text style={s.dot}>-</Text><Text style={{ flex: 1, lineHeight: 1.5 }}>{line}</Text></View>
              ))}
            </View>
          ))}
        </View>

        <Text fixed style={s.foot} render={({ pageNumber, totalPages }) => `${q.number}  ·  Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

const qtyNum = (q: string) => {
  const n = parseFloat(String(q).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 1;
};

/** continuous numbering across offers on the OFFER TOTAL table */
function cellNo(offers: any[], oi: number, i: number) {
  let n = 0;
  for (let k = 0; k < oi; k++) n += (offers[k].items ?? []).length;
  return n + i + 1;
}

function dmy(d: string | Date | undefined) {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}.${String(x.getUTCMonth() + 1).padStart(2, "0")}.${x.getUTCFullYear()}`;
}
