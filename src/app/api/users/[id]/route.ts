import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { diffChanges } from "@/lib/auditDiff";
import { User } from "@/models/User";
import { USERNAME_HINT, USERNAME_RE, normUsername } from "@/lib/username";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  username: z.string().transform(normUsername).refine((s) => USERNAME_RE.test(s), `Username: ${USERNAME_HINT}`).optional(),
  role: z.enum(["admin", "sales", "stock", "viewer"]).optional(),
  phone: z.string().trim().optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});

export const PUT = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const params = await ctx.params;
  const session = await guardAccess("users");
  const { password, ...rest } = updateSchema.parse(await req.json());
  if (params.id === session.user.id && (rest.active === false || (rest.role && rest.role !== "admin")))
    return NextResponse.json({ error: "You cannot deactivate or demote your own account" }, { status: 400 });
  await dbConnect();
  // a user given the Users page who is not an admin cannot touch admin accounts, make admins or change their own role
  if (session.user.role !== "admin") {
    const target = await User.findById(params.id).select("role").lean<{ role: string } | null>();
    if (target?.role === "admin" || rest.role === "admin") return NextResponse.json({ error: "Only an admin can create or change an admin account" }, { status: 403 });
    if (params.id === session.user.id && rest.role && rest.role !== session.user.role) return NextResponse.json({ error: "You cannot change your own role" }, { status: 403 });
  }
  if (rest.username && await User.exists({ username: rest.username, _id: { $ne: params.id } })) return NextResponse.json({ error: `The username “${rest.username}” is already taken` }, { status: 409 });
  const patch: Record<string, unknown> = { ...rest };
  if (password) patch.passwordHash = await bcrypt.hash(password, 10);
  const before = await User.findById(params.id).select("-passwordHash").lean();
  await User.updateOne({ _id: params.id }, patch);
  const u = await User.findById(params.id).select("-passwordHash").lean<{ email: string } | null>();
  if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });
  await audit(session, "update", "user", params.id, `Updated user ${u.email}${password ? " (password reset)" : ""}${rest.active === false ? " (deactivated)" : ""}`,
    [...diffChanges(before, u), ...(password ? [{ field: "Password", to: "reset by admin" }] : [])]);
  return NextResponse.json({ item: u });
});
