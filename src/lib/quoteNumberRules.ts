/* The rules for a quotation number typed by hand (used by the screens and the server). */
import { z } from "zod";

export const normNumber = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");
export const NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9 ./_()#-]{0,59}$/;
export const NUMBER_HINT = "Up to 60 characters: letters, digits, spaces and / . - _ ( ) #";
/** an optional number in a save request: empty = keep the current one (or, for a new quotation, the next in the series) */
export const numberField = z.string().optional().transform((v) => normNumber(v))
  .refine((v) => !v || NUMBER_RE.test(v), `Quotation number: ${NUMBER_HINT}`);
