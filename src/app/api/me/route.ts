import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";
export const GET = () => handle(async () => {
  const s = await guard(); await dbConnect();
  return NextResponse.json({ item: await User.findById(s.user.id).select("name email phone role").lean() });
});
export const PUT = (req: NextRequest) => handle(async () => {
  const s = await guard();
  const d = z.object({ name: z.string().trim().min(2, "Name is required"), phone: z.string().trim().default("") }).parse(await req.json()); await dbConnect();
  await User.updateOne({ _id: s.user.id }, d);
  const u = await User.findById(s.user.id).select("name email phone role").lean<{ email: string }>();
  await audit(s, "update", "profile", s.user.id, `${u?.email} updated own profile`);
  return NextResponse.json({ item: u });
});
