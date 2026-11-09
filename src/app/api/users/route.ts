import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  await guard(["admin"]);
  await dbConnect();
  return NextResponse.json({ items: await User.find().select("-passwordHash").sort({ name: 1 }).lean() });
});

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "sales", "viewer"]),
  phone: z.string().trim().optional().default(""),
});

export const POST = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin"]);
  const { password, ...rest } = createSchema.parse(await req.json());
  await dbConnect();
  const u = await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
  await audit(session, "create", "user", String(u._id), `Created user ${u.email} (${u.role})`);
  return NextResponse.json({ item: { _id: u._id, name: u.name, email: u.email, role: u.role } }, { status: 201 });
});
