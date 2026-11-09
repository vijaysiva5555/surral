import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { handle } from "@/lib/api";
import { appUrl, mailConfigured, sendMail } from "@/lib/mail";
import { tooMany } from "@/lib/rateLimit";
import { User } from "@/models/User";
import { PasswordReset } from "@/models/PasswordReset";

/** Always answers the same way, so it cannot be used to discover which e-mail addresses have accounts */
export const POST = (req: NextRequest) => handle(async () => {
  const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(await req.json());
  const reply = NextResponse.json({ ok: true, message: "If that address belongs to an account, a reset link has been sent." });
  if (tooMany(`forgot:${email}`, 3, 60 * 60_000) || tooMany(`forgot-ip:${req.headers.get("x-forwarded-for") ?? "local"}`, 15, 60 * 60_000)) return reply;
  await dbConnect();
  const u = await User.findOne({ email, active: true });
  if (!u) return reply;
  const token = crypto.randomBytes(32).toString("hex");
  await PasswordReset.deleteMany({ userId: u._id });
  await PasswordReset.create({ userId: u._id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60 * 60_000) });
  const link = `${appUrl()}/reset/${token}`;
  if (mailConfigured()) await sendMail({ to: [u.email], subject: "Reset your Surral Quote password", text: `Hello ${u.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${link}\n\nIf you did not ask for this, you can ignore this e-mail.` }).catch((e) => console.error("reset mail failed", e));
  else console.warn(`[password reset] e-mail is not configured. Reset link for ${u.email}: ${link}`);
  return reply;
});
