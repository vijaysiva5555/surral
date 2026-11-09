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
export async function expireOverdue() {
  await renameLegacyQuoteStatuses();
  const startOfToday = new Date(); startOfToday.setUTCHours(0, 0, 0, 0);
  await Quote.updateMany({ status: "sent", validUntil: { $lt: startOfToday } }, { status: "expired" });
}
