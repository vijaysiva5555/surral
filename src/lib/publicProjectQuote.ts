/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProjectQuote } from "@/models/ProjectQuote";
import { dbConnect } from "./db";

/** project offer for the public link: only while the link is live */
export async function findSharedProject(token: string, countView = false) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  await dbConnect();
  const q: any = await ProjectQuote.findOne({ shareToken: token });
  if (!q || (q.shareExpiresAt && q.shareExpiresAt < new Date())) return null;
  if (countView) {
    q.shareViews = (q.shareViews ?? 0) + 1;
    q.shareLastViewedAt = new Date();
    await q.save();
  }
  return q;
}
