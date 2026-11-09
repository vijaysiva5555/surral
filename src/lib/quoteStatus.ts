import { z } from "zod";

/** Stored on quotations in MongoDB */
export const QUOTE_STATUSES = ["draft", "sent", "agree", "rejected", "expired", "superseded"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Statuses users can set on a quotation (excludes superseded) */
export const QUOTE_STATUS_PATCH = ["draft", "sent", "agree", "rejected", "expired"] as const;

export const QUOTE_STATUS_PIPELINE = ["draft", "sent", "agree", "rejected", "expired"] as const;

export const quoteStatusPatchSchema = z.enum(QUOTE_STATUS_PATCH);

const LEGACY_LABEL: Record<string, string> = { won: "Agree", lost: "Rejected", accepted: "Agree" };

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  agree: "Agree",
  rejected: "Rejected",
  expired: "Expired",
  superseded: "Superseded",
};

export function quoteStatusLabel(status: string): string {
  return QUOTE_STATUS_LABEL[status as QuoteStatus] ?? LEGACY_LABEL[status] ?? status;
}
