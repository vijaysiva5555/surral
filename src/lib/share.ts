/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

export async function ensureShare(q: any) {
  if (!q.shareToken) {
    q.shareToken = crypto.randomBytes(24).toString("base64url");
    q.shareExpiresAt = new Date(Math.max(+new Date(q.validUntil ?? Date.now()), Date.now()) + 30 * 86400000);
    q.shareViews = 0;
    await q.save();
  }
  return q;
}
