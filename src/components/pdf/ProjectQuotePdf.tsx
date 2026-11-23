/* eslint-disable @typescript-eslint/no-explicit-any, jsx-a11y/alt-text */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { inr } from "@/lib/format";
import { fit } from "@/lib/imageSize";
import { lineAmount, lineGross, pctText, supplyLists, technicalsOf, type SupplyRow } from "@/lib/projectQuote";

Font.registerHyphenationCallback((w) => [w]);

const NAVY = "#0B2C4D", BLUE = "#0AA5E8", LINE = "#B6C2CE", SOFT = "#F4F8FB", MUTED = "#55657A";

const SUB_POINT = /^[•·\-–]\s*/;
// no lineHeight on wrapping text inside a flex row: react-pdf leaves big gaps and overlaps lines with it
const COLS = { sno: 32, desc: 265, qty: 58, unit: 90, total: 90 };

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 42, paddingHorizontal: 30, fontFamily: "Helvetica", fontSize: 8.5, color: "#111" },
  head: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1.2, borderBottomColor: NAVY, paddingBottom: 6 },
  coName: { fontFamily: "Helvetica-BoldOblique", fontSize: 17, color: NAVY, textAlign: "center" },
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
  coItalic: { fontFamily: "Helvetica-BoldOblique" },
  termLab: { fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 8.5, marginTop: 6 },
  termVal: { fontSize: 8.5, lineHeight: 1.5 },
});

const Cell = ({ w, style, children }: { w?: number; style?: any; children?: React.ReactNode }) => (
  <View style={[s.td, w ? { width: w } : { flex: 1 }, style]}>{children}</View>
);

/** offer images: two per row across the 535pt content width, never cut across a page break */
const IMG_W = 260, IMG_H = 190;

export default function ProjectQuotePdf({ q, logo, offerImages = [], techImages = [] }: { q: any; logo?: any; offerImages?: any[][]; techImages?: any[] }) {
  const co = q.company ?? {}, cu = q.customer ?? {}, t = q.totals ?? {};
  const addr: string[] = co.addressLines ?? [];
  const offers: any[] = q.offers ?? [];

  return (
    <Document title={`Project Quotation ${q.number}`} author={co.name}>
      <Page size="A4" style={s.page}>
        <View fixed render={({ pageNumber }) => (pageNumber > 1 ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, paddingBottom: 3, borderBottomWidth: 0.6, borderBottomColor: LINE }}>
            <Text style={{ fontFamily: "Helvetica-BoldOblique", fontSize: 8 }}>{co.name}</Text>
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
          <Text style={[s.bold, { marginTop: 10 }]}>For <Text style={s.coItalic}>{co.name}</Text>,</Text>
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
                <View key={i} style={s.bullet}><Text style={s.dot}>-</Text><Text style={{ flex: 1 }}>{x}</Text></View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.eqHead}>Details: Surral Equipment’s</Text>
              {(q.equipmentSurral ?? []).map((x: string, i: number) => (
                <View key={i} style={s.bullet}><Text style={s.dot}>-</Text><Text style={{ flex: 1 }}>{x}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* ---- technical descriptions: spec table with the photo beside it ---- */}
        {technicalsOf(q).map((tch, ti) => {
          const img = techImages[ti], specW = img ? 360 : 535;
          return (
            <View key={ti} wrap={false} style={{ marginTop: 10 }}>
              <Text style={[s.offerTitle, { fontSize: 9, marginTop: 0 }]}>TECHNICAL DESCRIPTION: - <Text style={{ fontFamily: "Helvetica", color: "#111" }}>{tch.title}</Text></Text>
              <View style={{ flexDirection: "row", marginTop: 5 }}>
                <View style={{ width: specW }}>
                  <Text style={[s.th, { width: specW, textAlign: "center", backgroundColor: "#0070C0", color: "#fff", fontSize: 10 }]}>Technical Specifications</Text>
                  {(tch.specs ?? []).map((sp: any, i: number) => (
                    <View key={i} style={{ flexDirection: "row" }}>
                      <Cell w={specW / 2} style={s.ctr}><Text>{sp.label}</Text></Cell>
                      <Cell w={specW / 2} style={s.ctr}><Text>{sp.value}</Text></Cell>
                    </View>
                  ))}
                  <Cell w={specW} style={s.ctr}><Text style={s.small}>Image is for illustrative purposes only.</Text></Cell>
                </View>
                {img && <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingLeft: 10 }}><Image src={{ data: img.data, format: img.format }} style={fit(img, 160, 210)} /></View>}
              </View>
            </View>
          );
        })}

        {/* ---- offers ---- */}
        {offers.map((o, oi) => (
          <React.Fragment key={oi}>
          <View wrap={false}>
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
                  <Cell w={COLS.total} style={s.num}><Text style={s.bold}>{inr(lineGross(l))}</Text></Cell>
                </View>
              ))}
            </View>

            {(() => {
              const { graco, surral } = supplyLists(o, oi);
              return [[graco, "Graco Supply Consists of: -", true], [surral, "Surral Supply Consists of: -", false]].map(([part, title, withHead]: any, k) => (
                <React.Fragment key={k}>
                  {part.sub && (
                    <View style={{ flexDirection: "row", marginTop: 6 }}>
                      <Cell w={COLS.sno} style={s.ctr}><Text>{part.sub.no}</Text></Cell>
                      <Cell w={COLS.desc}><Text style={s.bold}>{part.sub.description}</Text></Cell>
                      <Cell w={COLS.qty} style={s.ctr}><Text>{part.sub.qty}</Text></Cell>
                      <Cell w={COLS.unit} style={s.num}><Text>{inr(part.sub.amount)}</Text></Cell>
                      <Cell w={COLS.total} style={s.num}><Text style={s.bold}>{inr(part.sub.amount)}</Text></Cell>
                    </View>
                  )}
                  {part.list.length > 0 && <SupplyTable title={title} rows={part.list} priced={part.priced} withHead={withHead || part.priced} />}
                </React.Fragment>
              ));
            })()}
          </View>
          {(offerImages[oi] ?? []).length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 6 }}>
              {offerImages[oi].map((img, gi) => (
                <View key={gi} wrap={false} style={{ width: IMG_W, height: IMG_H, marginTop: 6, alignItems: "center", justifyContent: "center", borderWidth: 0.6, borderColor: LINE }}>
                  <Image src={{ data: img.data, format: img.format }} style={fit(img, IMG_W - 8, IMG_H - 8)} />
                </View>
              ))}
            </View>
          )}
          </React.Fragment>
        ))}

        {/* ---- offer total ---- */}
        <View wrap={false} style={{ marginTop: 12 }}>
          <Text style={[s.offerTitle, { marginTop: 0 }]}>OFFER TOTAL</Text>
          {(() => {
            const lines: any[] = [...offers.flatMap((o) => o.items ?? []), ...(q.extras ?? [])];
            const dis = lines.some((l) => Number(l.discountPct) > 0);
            // with a Dis column the description gives up its width
            const W = { ...COLS, desc: dis ? COLS.desc - 40 : COLS.desc, dis: 40 };
            const front = W.sno + W.desc + W.qty + W.unit + (dis ? W.dis : 0);
            return (
              <>
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <Text style={[s.th, { width: W.sno }]}>S.No.</Text>
                  <Text style={[s.th, { width: W.desc }]}>Description</Text>
                  <Text style={[s.th, { width: W.qty }]}>Qty.</Text>
                  <Text style={[s.th, { width: W.unit }]}>Unit Price in Rs.</Text>
                  {dis && <Text style={[s.th, { width: W.dis, textAlign: "center" }]}>Dis</Text>}
                  <Text style={[s.th, { width: W.total }]}>Total Price in Rs.</Text>
                </View>
                {lines.map((l, i) => (
                  <View key={i} style={{ flexDirection: "row" }}>
                    <Cell w={W.sno} style={s.ctr}><Text>{i + 1}</Text></Cell>
                    <Cell w={W.desc}><Text>{l.description}</Text></Cell>
                    <Cell w={W.qty} style={s.ctr}><Text>{l.qty}</Text></Cell>
                    <Cell w={W.unit} style={s.num}><Text>{inr(l.unitPrice)}</Text></Cell>
                    {dis && <Cell w={W.dis} style={s.ctr}><Text>{Number(l.discountPct) > 0 ? pctText(l.discountPct) : ""}</Text></Cell>}
                    <Cell w={W.total} style={s.num}><Text>{inr(lineAmount(l))}</Text></Cell>
                  </View>
                ))}
                <View style={{ flexDirection: "row", backgroundColor: SOFT }}>
                  <Cell w={front} style={{ justifyContent: "center" }}><Text style={[s.bold, { textAlign: "right" }]}>Total</Text></Cell>
                  <Cell w={W.total} style={s.num}><Text style={s.bold}>{inr(t.total)}</Text></Cell>
                </View>
                <View style={{ flexDirection: "row" }}>
                  <Cell w={front}><Text style={s.bold}>Rupees: {String(t.words ?? "").replace(/^Rupees /, "")}</Text></Cell>
                  <Cell w={W.total} />
                </View>
              </>
            );
          })()}
          <Text style={{ marginTop: 4, fontFamily: "Helvetica-Bold" }}>{t.gstNote || "GST 18% Extra"}</Text>
        </View>

        {/* ---- exclusions ---- */}
        {(q.exclusions ?? []).length > 0 && (
          <View style={{ marginTop: 12 }} wrap={false}>
            <Text style={[s.offerTitle, { marginTop: 0 }]}>Exclusions: -</Text>
            {(q.exclusions ?? []).map((x: string, i: number) => (
              <View key={i} style={s.bullet}><Text style={s.dot}>-</Text><Text style={{ flex: 1 }}>{x}</Text></View>
            ))}
          </View>
        )}

        {/* ---- terms ---- */}
        <View style={{ marginTop: 12 }}>
          <Text style={[s.offerTitle, { marginTop: 0 }]}>TERMS &amp; CONDITIONS: -</Text>
          <Text style={{ marginTop: 3 }}>Above-mentioned prices are Ex, Chennai. Order to be placed on</Text>
          <Text style={[s.bold, { marginTop: 2 }]}>M/s. <Text style={s.coItalic}>{co.name}</Text>,</Text>
          {(co.addressLines ?? []).map((l: string, i: number) => <Text key={i}>{l}</Text>)}
          {!!co.gstin && <Text>GSTIN: - {co.gstin}</Text>}
          {!!co.email && <Text>E-Mail: - {co.email}</Text>}
          {(q.terms ?? []).map((tm: any, i: number) => (
            // a long block (the warranty) may run onto the next page; the heading stays with its first lines
            <View key={i}>
              <Text style={s.termLab} minPresenceAhead={40}>{String(tm.label).toUpperCase()}: -</Text>
              {String(tm.value).split(/\n+/).map((x) => x.trim()).filter(Boolean).map((line, j) => {
                const sub = SUB_POINT.test(line);   // a line starting with a bullet is a sub-point of the line above
                return (
                  <View key={j} style={[s.bullet, sub ? { paddingLeft: 12 } : {}]} wrap={false}>
                    <Text style={s.dot}>{sub ? "•" : "-"}</Text><Text style={{ flex: 1 }}>{sub ? line.replace(SUB_POINT, "") : line}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Text fixed style={s.foot} render={({ pageNumber, totalPages }) => `${q.number}  ·  Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

/** a Graco or Surral supply list: S.No / Description / Qty (and Unit / Total Price when its lines have prices); group headings span the row */
function SupplyTable({ title, rows, priced, withHead }: { title: string; rows: SupplyRow[]; priced: boolean; withHead: boolean }) {
  const desc = priced ? COLS.desc : COLS.desc + COLS.unit, qty = priced ? COLS.qty : COLS.qty + COLS.total;
  const full = COLS.sno + COLS.desc + COLS.qty + COLS.unit + COLS.total;
  return (
    <>
      <Text style={s.subHead}>{title}</Text>
      <View style={[s.tbl, { marginTop: 3 }]}>
        {withHead && (
          <View style={{ flexDirection: "row" }}>
            <Text style={[s.th, { width: COLS.sno }]}>S.No.</Text>
            <Text style={[s.th, { width: desc }]}>Description</Text>
            <Text style={[s.th, { width: qty }]}>Qty.</Text>
            {priced && <Text style={[s.th, { width: COLS.unit }]}>Unit Price in Rs.</Text>}
            {priced && <Text style={[s.th, { width: COLS.total }]}>Total Price in Rs.</Text>}
          </View>
        )}
        {rows.map((r, i) => (r.heading ? (
          <View key={i} style={{ flexDirection: "row" }}><Cell w={full}><Text style={s.bold}>{r.description}</Text></Cell></View>
        ) : (
          <View key={i} style={{ flexDirection: "row" }}>
            <Cell w={COLS.sno} style={s.ctr}><Text>{r.no}</Text></Cell>
            <Cell w={desc}><Text>{r.description}</Text></Cell>
            <Cell w={qty} style={s.ctr}><Text>{r.qty}</Text></Cell>
            {priced && <Cell w={COLS.unit} style={s.num}><Text>{r.unitPrice ? inr(r.unitPrice) : ""}</Text></Cell>}
            {priced && <Cell w={COLS.total} style={s.num}><Text>{r.amount ? inr(r.amount) : ""}</Text></Cell>}
          </View>
        )))}
      </View>
    </>
  );
}

function dmy(d: string | Date | undefined) {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}.${String(x.getUTCMonth() + 1).padStart(2, "0")}.${x.getUTCFullYear()}`;
}
