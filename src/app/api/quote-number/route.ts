/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guardAccess, handle } from "@/lib/api";
import { numberOwner, normNumber, type NumberSelf } from "@/lib/quoteNumber";
import { NUMBER_HINT, NUMBER_RE } from "@/lib/quoteNumberRules";
import { Quote } from "@/models/Quote";
import { Company } from "@/models/Company";
import { Counter } from "@/models/Counter";
import { financialYear } from "@/lib/quoteCalc";
import { formatQuoteNumber, quotePrefixFor, quoteStartNo } from "@/lib/quoteCategory";
import { projectNumberPrefix } from "@/lib/projectQuote";

export const dynamic = "force-dynamic";

/** Is this quotation number free? ?number=…&kind=quote|project&id=<the quotation being edited>
    The screens ask while the number is typed; saving checks again. */
export const GET = (req: NextRequest) => handle(async () => {
  await guardAccess(["equipmentQuotes", "spareQuotes", "projectQuotes"]);
  const sp = req.nextUrl.searchParams;
  // ?next=spare|equipment|project&date=YYYY-MM-DD – the number a new quotation would get now (nothing is reserved)
  const series = sp.get("next");
  if (series) {
    await dbConnect();
    const company: any = await Company.findOne().lean();
    const d = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date") ?? "") ? new Date(sp.get("date") + "T12:00:00Z") : new Date();
    const fy = financialYear(d);
    const key = series === "project" ? "projectQuote" : series === "equipment" ? "equipmentQuote" : "quote";
    const start = series === "project" ? company?.projectStartNo ?? 1 : quoteStartNo(company, series === "equipment" ? "equipment" : "spare");
    const c: any = await Counter.findOne({ key }).lean();
    const format = (s: number) => (series === "project"
      ? `${company?.projectPrefix || projectNumberPrefix(company)}/${s}/${fy}`
      : formatQuoteNumber(quotePrefixFor(company, series === "equipment" ? "equipment" : "spare"), s, fy, series === "equipment" ? "equipment" : "spare"));
    let s = (c?.seq ?? Math.max(1, start) - 1) + 1;
    for (let i = 0; i < 200 && (await numberOwner(format(s))); i++) s++;
    return NextResponse.json({ next: format(s) });
  }
  const number = normNumber(sp.get("number"));
  if (!number) return NextResponse.json({ ok: true, free: true });
  if (!NUMBER_RE.test(number)) return NextResponse.json({ ok: false, free: false, error: `Quotation number: ${NUMBER_HINT}` });
  await dbConnect();
  const id = sp.get("id"), kind = sp.get("kind");
  let self: NumberSelf = null;
  if (id && !/^[0-9a-f]{24}$/i.test(id)) return NextResponse.json({ error: "Unknown quotation" }, { status: 400 });
  if (id && kind === "project") self = { kind: "project", id };
  else if (id && /^[0-9a-f]{24}$/i.test(id)) { const q: any = await Quote.findById(id).select("category seq").lean(); if (q) self = { kind: "quote", category: q.category, seq: q.seq }; }
  const owner = await numberOwner(number, self);
  return NextResponse.json({ ok: !owner, free: !owner, error: owner ? `Already used by ${owner}.` : undefined });
});
