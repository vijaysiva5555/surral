import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { User } from "@/models/User";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.enum(["admin", "sales", "viewer"]).optional(),
  phone: z.string().trim().optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});

export const PUT = (req: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const session = await guard(["admin"]);
  const { password, ...rest } = updateSchema.parse(await req.json());
  if (params.id === session.user.id && (rest.active === false || (rest.role && rest.role !== "admin")))
    return NextResponse.json({ error: "You cannot deactivate or demote your own account" }, { status: 400 });
  await dbConnect();
  const patch: Record<string, unknown> = { ...rest };
  if (password) patch.passwordHash = await bcrypt.hash(password, 10);
  await User.updateOne({ _id: params.id }, patch);
  const u = await User.findById(params.id).select("-passwordHash").lean<{ email: string } | null>();
  if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });
  await audit(session, "update", "user", params.id, `Updated user ${u.email}${password ? " (password reset)" : ""}${rest.active === false ? " (deactivated)" : ""}`);
  return NextResponse.json({ item: u });
});
