import { Quote } from "@/models/Quote";

let legacyStatusesRenamed = false;

async function renameLegacyQuoteStatuses() {
  if (legacyStatusesRenamed) return;
  legacyStatusesRenamed = true;
  await Promise.all([
    Quote.updateMany({ status: { $in: ["won", "accepted"] } }, { $set: { status: "agree" } }),
    Quote.updateMany({ status: "lost" }, { $set: { status: "rejected" } }),
  ]);
}

/** "sent" quotations whose validity has ended become "expired" (runs whenever lists / dashboard load) */
let lastRun = 0;
const EVERY = 10 * 60_000;   // the rule only changes at midnight, so once every ten minutes per server is plenty

export async function expireOverdue() {
  if (Date.now() - lastRun < EVERY) return;
  lastRun = Date.now();
  await renameLegacyQuoteStatuses();
  const startOfToday = new Date(); startOfToday.setUTCHours(0, 0, 0, 0);
  await Quote.updateMany({ status: "sent", validUntil: { $lt: startOfToday } }, { status: "expired" });
}
