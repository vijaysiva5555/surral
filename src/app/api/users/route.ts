import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { diffChanges } from "@/lib/auditDiff";
import { User } from "@/models/User";
import { USERNAME_HINT, USERNAME_RE, normUsername } from "@/lib/username";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  await guardAccess("users", "view");
  await dbConnect();
  return NextResponse.json({ items: await User.find().select("-passwordHash").sort({ name: 1 }).lean() });
});

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  username: z.string({ required_error: "Enter a username" }).transform(normUsername).refine((s) => USERNAME_RE.test(s), `Username: ${USERNAME_HINT}`),
  email: z.string().trim().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "sales", "stock", "viewer"]),
  phone: z.string().trim().optional().default(""),
});

export const POST = (req: NextRequest) => handle(async () => {
  const session = await guardAccess("users");
  const { password, ...rest } = createSchema.parse(await req.json());
  // a user given the Users page who is not an admin cannot make admins
  if (session.user.role !== "admin" && rest.role === "admin") return NextResponse.json({ error: "Only an admin can create an admin account" }, { status: 403 });
  await dbConnect();
  if (await User.exists({ username: rest.username })) return NextResponse.json({ error: `The username “${rest.username}” is already taken` }, { status: 409 });
  const u = await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
  await audit(session, "create", "user", String(u._id), `Created user ${u.username} (${u.role})`, diffChanges(null, u, { only: ["name", "username", "email", "role", "phone"] }));
  return NextResponse.json({ item: { _id: u._id, name: u.name, username: u.username, email: u.email, role: u.role } }, { status: 201 });
});
