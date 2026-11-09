/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canEditQuote } from "@/lib/quoteAccess";
import { displayNumber } from "@/lib/quoteCalc";
import { appUrl, mailConfigured, sendMail } from "@/lib/mail";
import { renderQuotePdf } from "@/lib/quotePdf";
import { buildQuoteWorkbook } from "@/lib/quoteExcel";
import { rateLimitedEmail } from "@/lib/emailLimit";
import { Quote } from "@/models/Quote";
import { User } from "@/models/User";
import { ensureShare } from "@/lib/share";
import { canExportQuote, EXPORT_BLOCKED } from "@/lib/quoteApproval";

export const maxDuration = 60;
const list = z.string().default("").transform((s) => s.split(/[,;\s]+/).filter(Boolean)).pipe(z.array(z.string().email("Invalid e-mail address")));
const schema = z.object({ to: list.refine((a) => a.length > 0, "Enter at least one recipient"), cc: list, subject: z.string().trim().min(1, "Subject is required"), message: z.string().default(""), attachExcel: z.boolean().default(false), includeLink: z.boolean().default(false) });

export const POST = (req: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  const input = schema.parse(await req.json());
  if (!mailConfigured()) return NextResponse.json({ error: "E-mail is not configured on the server. Ask the administrator to set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM." }, { status: 400 });
  if (rateLimitedEmail(session.user.id)) return NextResponse.json({ error: "Too many e-mails in a short time – please wait a few minutes." }, { status: 429 });
  await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (!canEditQuote(session, q)) return NextResponse.json({ error: "You can only e-mail your own quotations" }, { status: 403 });
  if (!canExportQuote(session, q)) return NextResponse.json({ error: EXPORT_BLOCKED }, { status: 403 });

  let text = input.message;
  if (input.includeLink) { await ensureShare(q); text += `\n\nView this quotation online: ${appUrl()}/q/${q.shareToken}`; }
  const num = displayNumber(q).replace(/[\\/\s]+/g, "-");
  const plain = q.toObject();
  const attachments = [{ filename: `Quotation_${num}.pdf`, content: await renderQuotePdf(plain), contentType: "application/pdf" }];
  if (input.attachExcel) attachments.push({ filename: `Quotation_${num}.xlsx`, content: await buildQuoteWorkbook(plain), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const me = await User.findById(session.user.id).select("email").lean<any>();
  await sendMail({ to: input.to, cc: input.cc, subject: input.subject, text, attachments, replyTo: me?.email });

  q.emails = [...(q.emails ?? []), { at: new Date(), to: input.to.join(", "), by: session.user.name }];
  if (q.status === "draft") q.status = "sent";
  await q.save();
  await audit(session, "email", "quote", params.id, `E-mailed ${q.number} to ${input.to.join(", ")}`);
  return NextResponse.json({ ok: true, status: q.status, emails: q.emails });
});
