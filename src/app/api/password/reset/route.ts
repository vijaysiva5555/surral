import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { tooMany } from "@/lib/rateLimit";
import { User } from "@/models/User";
import { PasswordReset } from "@/models/PasswordReset";

export const POST = (req: NextRequest) => handle(async () => {
  if (tooMany(`reset:${req.headers.get("x-forwarded-for") ?? "local"}`, 20, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const { token, password } = z.object({ token: z.string().min(20), password: z.string().min(8, "Password must be at least 8 characters") }).parse(await req.json());
  await dbConnect();
  const r = await PasswordReset.findOne({ tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: { $gt: new Date() } });
  if (!r) return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
  const u = await User.findById(r.userId);
  if (!u || !u.active) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  u.passwordHash = await bcrypt.hash(password, 10); await u.save();
  await PasswordReset.deleteMany({ userId: u._id });
  await audit({ user: { id: String(u._id), name: u.name, role: u.role } } as never, "password", "user", String(u._id), `${u.email} reset password via e-mail link`);
  return NextResponse.json({ ok: true });
});
