/* eslint-disable @typescript-eslint/no-explicit-any */
/* Numbers for the dashboard: per-section counts by period and by status, recent quotations, customer value ranking.
   Sections: Equipment and Spare (Quote.category) and Project (ProjectQuote). Superseded revisions are never counted. */
import { Quote } from "@/models/Quote";
import { ProjectQuote } from "@/models/ProjectQuote";
import { QUOTE_STATUS_PIPELINE } from "@/lib/quoteStatus";

export type Section = "equipment" | "spare" | "project";
export const SECTIONS: Section[] = ["equipment", "spare", "project"];
export const SECTION_LABEL: Record<Section, string> = { equipment: "Equipment", spare: "Spare", project: "Project" };
export const SECTION_PATH: Record<Section, string> = { equipment: "/equipment/quotations", spare: "/spare/quotations", project: "/project/quotations" };

export type PeriodKey = "today" | "week" | "month" | "year";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" }, { key: "week", label: "This week" }, { key: "month", label: "This month" }, { key: "year", label: "This FY" },
];
export type Tally = { n: number; v: number };
export type SectionStats = {
  periods: Record<PeriodKey, Tally>;
  statuses: Record<(typeof QUOTE_STATUS_PIPELINE)[number], Tally>;
  total: Tally;
};

const IST = 330 * 60000;   // the business runs on India time: days, weeks and months start at IST midnight

/** start of today / this week (Monday) / this month / this financial year (1 April), as UTC instants */
export function periodStarts(now = new Date()): Record<PeriodKey, Date> {
  const ist = new Date(now.getTime() + IST);
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth(), d = ist.getUTCDate();
  const at = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd) - IST);
  const sinceMonday = (ist.getUTCDay() + 6) % 7;
  return { today: at(y, m, d), week: at(y, m, d - sinceMonday), month: at(y, m, 1), year: at(m >= 3 ? y : y - 1, 3, 1) };
}

const empty = (): SectionStats => ({
  periods: { today: { n: 0, v: 0 }, week: { n: 0, v: 0 }, month: { n: 0, v: 0 }, year: { n: 0, v: 0 } },
  statuses: Object.fromEntries(QUOTE_STATUS_PIPELINE.map((s) => [s, { n: 0, v: 0 }])) as SectionStats["statuses"],
  total: { n: 0, v: 0 },
});

/** one $facet pipeline, used on quotes (grouped by category) and on project quotes (one group) */
function statsPipeline(starts: Record<PeriodKey, Date>, groupKey: any) {
  const val = { $ifNull: ["$totals.total", 0] };
  const inPeriod = (k: PeriodKey) => ({ $gte: ["$date", starts[k]] });
  return [
    { $match: { status: { $ne: "superseded" } } },
    {
      $facet: {
        periods: [{
          $group: {
            _id: groupKey,
            n: { $sum: 1 }, v: { $sum: val },
            ...Object.fromEntries(PERIODS.flatMap(({ key }) => [
              [`${key}N`, { $sum: { $cond: [inPeriod(key), 1, 0] } }],
              [`${key}V`, { $sum: { $cond: [inPeriod(key), val, 0] } }],
            ])),
          },
        }],
        statuses: [{ $group: { _id: { g: groupKey, s: "$status" }, n: { $sum: 1 }, v: { $sum: val } } }],
      },
    },
  ];
}

function fill(target: Record<string, SectionStats>, facet: any, keyOf: (id: any) => string) {
  for (const r of facet.periods ?? []) {
    const st = (target[keyOf(r._id)] ??= empty());
    st.total = { n: r.n, v: r.v };
    for (const { key } of PERIODS) st.periods[key] = { n: r[`${key}N`], v: r[`${key}V`] };
  }
  for (const r of facet.statuses ?? []) {
    const st = (target[keyOf(r._id.g)] ??= empty());
    if (r._id.s in st.statuses) st.statuses[r._id.s as keyof SectionStats["statuses"]] = { n: r.n, v: r.v };
  }
}

export async function sectionStats(now = new Date()): Promise<Record<Section, SectionStats>> {
  const starts = periodStarts(now);
  const [[q], [p]] = await Promise.all([
    Quote.aggregate(statsPipeline(starts, { $ifNull: ["$category", "spare"] }) as any[]),
    ProjectQuote.aggregate(statsPipeline(starts, "project") as any[]),
  ]);
  const out: Record<string, SectionStats> = { equipment: empty(), spare: empty(), project: empty() };
  fill(out, q, (id) => (id === "equipment" ? "equipment" : "spare"));
  fill(out, p, () => "project");
  return out as Record<Section, SectionStats>;
}

export type RecentRow = { _id: string; number: string; revision?: number; date: Date; status: string; customer?: { name?: string }; totals?: { total?: number }; subject?: string };

export async function recentBySection(limit = 5): Promise<Record<Section, RecentRow[]>> {
  const cols = "number revision date status customer.name totals.total";
  const [equipment, spare, project] = await Promise.all([
    Quote.find({ category: "equipment", status: { $ne: "superseded" } }).sort({ createdAt: -1 }).limit(limit).select(cols).lean<RecentRow[]>(),
    Quote.find({ category: "spare", status: { $ne: "superseded" } }).sort({ createdAt: -1 }).limit(limit).select(cols).lean<RecentRow[]>(),
    ProjectQuote.find().sort({ createdAt: -1 }).limit(limit).select(`${cols} subject`).lean<RecentRow[]>(),
  ]);
  return { equipment, spare, project };
}

export type CustomerValue = { id: string; name: string; v: number; n: number; agreeV: number };

/** customers ranked by the total value quoted to them across all three sections */
export async function customerValues(limit = 5): Promise<{ high: CustomerValue[]; low: CustomerValue[] }> {
  const rows: any[] = await Quote.aggregate([
    { $match: { status: { $ne: "superseded" } } },
    { $project: { customerId: 1, name: "$customer.name", status: 1, v: { $ifNull: ["$totals.total", 0] } } },
    { $unionWith: { coll: ProjectQuote.collection.collectionName, pipeline: [
      { $project: { customerId: 1, name: "$customer.name", status: 1, v: { $ifNull: ["$totals.total", 0] } } },
    ] } },
    { $group: {
      _id: { $ifNull: ["$customerId", "$name"] }, name: { $last: "$name" }, n: { $sum: 1 }, v: { $sum: "$v" },
      agreeV: { $sum: { $cond: [{ $eq: ["$status", "agree"] }, "$v", 0] } },
    } },
    { $sort: { v: -1 } },
  ]);
  const all: CustomerValue[] = rows.map((r) => ({ id: String(r._id), name: r.name ?? "—", v: r.v, n: r.n, agreeV: r.agreeV }));
  // with only a few customers, split them evenly so neither list is empty and nobody appears in both
  const highCount = Math.min(limit, Math.ceil(all.length / 2));
  const high = all.slice(0, highCount);
  const low = all.slice(Math.max(highCount, all.length - limit)).reverse();
  return { high, low };
}
