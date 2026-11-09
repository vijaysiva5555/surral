import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { tooMany } from "@/lib/rateLimit";
import { User } from "@/models/User";

export const POST = (req: NextRequest) => handle(async () => {
  const s = await guard();
  if (tooMany(`pw:${s.user.id}`, 8, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const d = z.object({ current: z.string().min(1, "Enter your current password"), next: z.string().min(8, "New password must be at least 8 characters") }).parse(await req.json());
  await dbConnect();
  const u = await User.findById(s.user.id);
  if (!u || !(await bcrypt.compare(d.current, u.passwordHash))) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  if (d.current === d.next) return NextResponse.json({ error: "Choose a different password" }, { status: 400 });
  u.passwordHash = await bcrypt.hash(d.next, 10); await u.save();
  await audit(s, "password", "user", s.user.id, `${u.email} changed own password`);
  return NextResponse.json({ ok: true });
});
